import imaplib
from typing import Optional, cast
import email
import email.utils
import os
import re
import uuid
import shutil
import subprocess
import datetime
import base64
import hashlib
from cryptography.fernet import Fernet
from django.conf import settings
from django.utils import timezone
from allauth.socialaccount.models import SocialToken
from .models import Attachment, Rule, Folder

def delete_old_attachments(user):
    """Deletes attachments older than 30 days or based on storage rules."""
    threshold = timezone.now() - datetime.timedelta(days=30)
    
    # 1. Faster removal of 30+ day old files using direct DB filtering
    old_files = Attachment.objects.filter(user=user, created_at__lt=threshold)
    deleted_count: int = old_files.count()
    
    for att in old_files:
        if att.encrypted_file_path and os.path.exists(att.encrypted_file_path):
            try:
                os.remove(att.encrypted_file_path)
            except Exception as e:
                print(f"Cleanup Error (Age): {e}")
    
    old_files.delete()

    # 2. Size-based cleanup for existing files
    user_files = Attachment.objects.filter(user=user)
    for att in user_files:
        if att.encrypted_file_path and os.path.exists(att.encrypted_file_path):
            if os.path.getsize(att.encrypted_file_path) > 5 * 1024 * 1024:
                _did_delete: bool = False
                try:
                    os.remove(att.encrypted_file_path)
                    att.delete()
                    _did_delete = True
                except Exception as e:
                    print(f"Cleanup Error (Size): {e}")
                if _did_delete:
                    deleted_count = cast(int, deleted_count) + 1

    if deleted_count > 0:
        print(f"Automated Cleanup: Removed {deleted_count} attachments.")

def scan_file_with_clamav(file_path):
    """Scans a file for viruses using ClamAV."""
    # Attempt to use setting or find it in common Windows path
    clamav_path = getattr(settings, 'CLAMAV_PATH', r"C:\Program Files\ClamAV\clamscan.exe")
    
    if not os.path.exists(clamav_path):
        print(f"[ClamAV] ⚠️ ClamAV not found at {clamav_path}. Skipping scan.")
        return True

    try:
        print(f"[ClamAV] Scanning file: {file_path}")
        result = subprocess.run(
            [clamav_path, file_path],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print(f"[ClamAV] ✅ File is CLEAN: {file_path}")
            return True
        elif result.returncode == 1:
            print(f"[ClamAV] ❌ VIRUS DETECTED in: {file_path}")
            return False
        else:
            print(f"[ClamAV] ⚠️ Error (code {result.returncode})")
            return True

    except Exception as e:
        print(f"[ClamAV] 🚫 Execution error: {e}")
        return True

class FileEncryption:
    @staticmethod
    def _get_key(user_id):
        # Generate a stable key for this user based on Django's SECRET_KEY
        # In a production app, you'd store a unique key per user in the DB
        seed = f"{settings.SECRET_KEY}-{user_id}"
        key = hashlib.sha256(seed.encode()).digest()
        return base64.urlsafe_b64encode(key)

    @classmethod
    def encrypt(cls, payload, user_id):
        f = Fernet(cls._get_key(user_id))
        return f.encrypt(payload)

    @classmethod
    def decrypt(cls, encrypted_payload, user_id):
        f = Fernet(cls._get_key(user_id))
        return f.decrypt(encrypted_payload)

class EmailProcessor:
    def __init__(self, user):
        self.user = user
        self.mail: Optional[imaplib.IMAP4_SSL] = None

    def connect(self):
        token = SocialToken.objects.filter(account__user=self.user).first()
        if not token:
            raise Exception("No Google token found")

        access_token = token.token
        auth_string = f"user={self.user.email}\1auth=Bearer {access_token}\1\1"
        auth_bytes: bytes = auth_string.encode()

        self.mail = imaplib.IMAP4_SSL("imap.gmail.com")
        self.mail.authenticate("XOAUTH2", lambda x: auth_bytes)
        self.mail.select("inbox")

    def disconnect(self):
        if self.mail:
            try:
                self.mail.logout()
            except:
                pass

    def process_unseen_emails(self):
        if not self.mail:
            self.connect()

        status, messages = self.mail.uid('search', None, "UNSEEN")
        if status != "OK":
            return 0, 0

        email_uids = messages[0].split()
        rules = Rule.objects.filter(user=self.user)
        
        num_emails = len(email_uids)
        num_attachments = 0

        for uid_bytes in email_uids:
            email_uid = uid_bytes.decode()
            try:
                status, msg_data = self.mail.uid('fetch', email_uid, "(RFC822)")
                if status != "OK" or not msg_data[0]:
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                sender = msg.get("From")
                
                for part in msg.walk():
                    if part.is_multipart():
                        continue

                    filename = part.get_filename()
                    if not filename:
                        continue
                    
                    matched_folders = self._match_rules(rules, sender, filename)

                    if matched_folders:
                        payload = part.get_payload(decode=True)
                        if len(payload) > 5 * 1024 * 1024: # 5MB Limit
                            continue

                        # Encrypt the payload before saving
                        encrypted_payload = FileEncryption.encrypt(payload, self.user.id)

                        # Save file and scan (Scan raw payload if possible, or decrypted file)
                        saved_path = self._save_attachment(encrypted_payload, filename, matched_folders[0].name)
                        if not saved_path:
                            continue

                        if not scan_file_with_clamav(saved_path):
                            os.remove(saved_path)
                            continue

                        # Create DB records
                        self._create_attachment_records(matched_folders, sender, filename, saved_path, email_uid)
                        num_attachments += 1

                # Mark as read
                self.mail.uid('store', email_uid, '+FLAGS', '\\Seen')

            except Exception as e:
                print(f"[Error] Processing UID {email_uid}: {e}")
                continue

        return num_emails, num_attachments

    def _match_rules(self, rules, sender, filename):
        matched_folders = []
        sender_name_part, sender_email_addr = email.utils.parseaddr(sender)
        sender_domain = sender_email_addr.split("@")[-1]

        for rule in rules:
            # Match Sender
            match_sender = not rule.sender_email or (
                rule.sender_email.lower() in sender_email_addr.lower() or 
                rule.sender_email.lower() in sender_name_part.lower()
            )

            # Match Domain
            match_domain = not rule.domain or rule.domain.lower() == sender_domain.lower()

            # Match File Type
            match_filetype = False
            if not rule.file_type or rule.file_type.lower() == "all":
                match_filetype = True
            else:
                ft = rule.file_type.lower()
                ext_map = {
                    "pdf": [".pdf"],
                    "doc": [".doc", ".docx"],
                    "excel": [".xls", ".xlsx"],
                    "powerpoint": [".ppt", ".pptx"],
                    "txt": [".txt"],
                    "image": [".jpg", ".jpeg", ".png"]
                }
                if ft in ext_map:
                    match_filetype = any(filename.lower().endswith(ext) for ext in ext_map[ft])

            if match_sender and match_domain and match_filetype:
                matched_folders.append(rule.folder)
        
        return matched_folders

    def _save_attachment(self, payload, filename, first_folder_name):
        safe_filename = re.sub(r'[\\/*?:"<>|]', "", filename)
        name_parts = os.path.splitext(safe_filename)
        
        # Use UUID for the actual stored filename for security and uniqueness
        unique_id = uuid.uuid4().hex
        stored_filename = f"{name_parts[0][:40]}_{unique_id}{name_parts[1]}"

        base_user_folder = os.path.join(settings.BASE_DIR, "backend", "user_folders")
        # Isolate by user email
        user_folder = os.path.join(base_user_folder, self.user.email)
        os.makedirs(user_folder, exist_ok=True)

        target_folder_path = os.path.join(user_folder, first_folder_name)
        os.makedirs(target_folder_path, exist_ok=True)
        
        full_path = os.path.join(target_folder_path, stored_filename)

        with open(full_path, "wb") as f:
            f.write(payload)
            
        return full_path

    def _create_attachment_records(self, folders, sender, filename, source_path, email_uid):
        base_user_folder = os.path.join(settings.BASE_DIR, "backend", "user_folders")
        # Isolate by user email
        user_folder = os.path.join(base_user_folder, self.user.email)
        os.makedirs(user_folder, exist_ok=True)

        for i, folder in enumerate(folders):
            if Attachment.objects.filter(user=self.user, email_uid=email_uid, original_filename=filename, folder=folder).exists():
                continue

            # For secondary folders, copy the file
            folder_path = os.path.join(user_folder, folder.name)
            os.makedirs(folder_path, exist_ok=True)
            dest_path = os.path.join(folder_path, os.path.basename(source_path))

            if dest_path != source_path:
                shutil.copy2(source_path, dest_path)

            Attachment.objects.create(
                user=self.user,
                folder=folder,
                sender_email=sender,
                original_filename=filename,
                encrypted_file_path=dest_path,
                email_uid=email_uid
            )

