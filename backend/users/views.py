from django.http import JsonResponse, FileResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render, redirect
from django.conf import settings
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.contrib.auth import logout
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.utils import timezone
import json
import time
import os
import random
import io
from .models import Folder, Attachment, Rule, Passkey
from .services import delete_old_attachments, EmailProcessor, FileEncryption


def register(request):
    return render(request, "users/register.html")


@login_required
def logout_view(request):
    logout(request)
    return redirect("register")

@login_required
def create_folder(request):
    if request.method == "POST":
        data = json.loads(request.body)

        folder_name = data.get("folder_name")
        domain = data.get("domain") or ""
        sender_email = data.get("sender_email") or ""
        file_type = data.get("file_type") or ""

        if not folder_name:
            return JsonResponse({"error": "Folder name required"}, status=400)

        has_filters = sender_email or domain or file_type

        # If no filters provided, auto-assign "all" file type
        if not has_filters:
            # Check if an "all files" folder already exists
            existing_all = Rule.objects.filter(
                user=request.user,
                file_type__iexact="all",
                sender_email="",
                domain=""
            ).exists()

            if existing_all:
                return JsonResponse({"error": "You already have a folder that collects all file types. Please specify a filter (sender, domain, or file type)."}, status=400)

            file_type = "all"

        else:
            # Check if an identical rule already exists
            conflict = Rule.objects.filter(
                user=request.user,
                sender_email__iexact=sender_email,
                domain__iexact=domain,
                file_type__iexact=file_type
            ).exists()

            if conflict:
                return JsonResponse({"error": "A folder with the same rules already exists."}, status=400)

        folder = Folder.objects.create(
            user=request.user,
            name=folder_name
        )

        Rule.objects.create(
            user=request.user,
            folder=folder,
            sender_email=sender_email,
            domain=domain,
            file_type=file_type
        )

        return JsonResponse({"success": True})

    return JsonResponse({"error": "Invalid request"}, status=405)

@login_required
def dashboard(request):

    user = request.user
    folders = Folder.objects.filter(user=user)

    passkey_exists = False
    passkey_days_remaining = 0
    passkey_expired = False

    passkey_obj = Passkey.objects.filter(user=user).first()

    if passkey_obj:

        passkey_exists = True
        
        # Calculate remaining days based on calendar dates to satisfy user expectation
        # (e.g., if set yesterday, it should show 13 days today even if < 24h passed)
        today = timezone.now()
        today_date = timezone.localtime(today).date()
        updated_date = timezone.localtime(passkey_obj.updated_at).date()
        
        days_passed = (today_date - updated_date).days
        remaining_days = 14 - days_passed
        
        if remaining_days <= 0:
            passkey_expired = True
            passkey_days_remaining = 0
        else:
            passkey_days_remaining = remaining_days

    # Calculate total storage used
    total_size = 0
    attachments = Attachment.objects.filter(user=user)
    for att in attachments:
        try:
            if att.encrypted_file_path and os.path.exists(att.encrypted_file_path):
                total_size += os.path.getsize(att.encrypted_file_path)
        except OSError:
            continue
            
    # Format size for display (e.g. 5.2 MB)
    if total_size < 1024 * 1024:
        storage_display = f"{total_size / 1024:.1f} KB"
    else:
        storage_display = f"{total_size / (1024 * 1024):.1f} MB"

    return render(request, "users/dashboard.html", {
        "folders": folders,
        "user_email": user.email,
        "passkey_exists": passkey_exists,
        "passkey_days_remaining": passkey_days_remaining,
        "passkey_expired": passkey_expired,
        "total_storage": storage_display,
    })


@require_POST
@login_required
def rename_folder(request, folder_id):
    try:
        data = json.loads(request.body)
        new_name = data.get("name")

        if not new_name:
            return JsonResponse({"error": "New name required"}, status=400)

        folder = Folder.objects.get(id=folder_id, user=request.user)
        folder.name = new_name
        folder.save()

        return JsonResponse({"success": True})

    except Folder.DoesNotExist:
        return JsonResponse({"error": "Folder not found"}, status=404)

@require_POST
@login_required
def delete_folder(request, folder_id):
    try:
        folder = Folder.objects.get(id=folder_id, user=request.user)
        
        # 1. Get all attachments in this folder for this user and delete their physical files
        attachments = Attachment.objects.filter(folder=folder, user=request.user)
        for att in attachments:
            if att.encrypted_file_path and os.path.exists(att.encrypted_file_path):
                try:
                    os.remove(att.encrypted_file_path)
                except Exception as e:
                    print(f"Error deleting file {att.encrypted_file_path}: {e}")

        # 2. Get the physical folder path to try deleting it later
        base_user_folder = os.path.join(settings.BASE_DIR, "backend", "user_folders")
        user_folder = os.path.join(base_user_folder, request.user.email)
        target_folder_path = os.path.join(user_folder, folder.name)

        # 3. Delete the folder from DB (cascades to Rule and Attachment records)
        folder.delete()

        # 4. Try to remove the physical directory if it's empty
        if os.path.exists(target_folder_path):
            try:
                # Only remove if it's empty
                if not os.listdir(target_folder_path):
                    os.rmdir(target_folder_path)
            except Exception as e:
                print(f"Error removing directory {target_folder_path}: {e}")

        # 5. Also try to remove the user's root folder if it's empty
        if os.path.exists(user_folder):
            try:
                if not os.listdir(user_folder):
                    os.rmdir(user_folder)
            except Exception as e:
                print(f"Error removing user directory {user_folder}: {e}")

        return JsonResponse({"success": True})
    except Folder.DoesNotExist:
        return JsonResponse({"error": "Folder not found"}, status=404)


@csrf_exempt
@login_required
def extract_emails(request):
    try:
        user = request.user
        
        # Run auto-cleanup for old files
        delete_old_attachments(user)

        processor = EmailProcessor(user)
        try:
            num_emails, num_attachments = processor.process_unseen_emails()
        finally:
            processor.disconnect()

        return JsonResponse({
            "success": True,
            "emails_processed": num_emails,
            "attachments_saved": num_attachments
        })

    except Exception as e:
        print(f"[Extract Error] {e}")
        return JsonResponse({"error": str(e)}, status=500)

from celery.result import AsyncResult

@login_required
def get_task_status(request, task_id):
    task = AsyncResult(task_id)
    response_data = {
        'state': task.state
    }
    
    if task.state == 'SUCCESS':
        response_data['result'] = task.result
    elif task.state == 'PROGRESS':
        response_data['status'] = task.info.get('status', '') if task.info else ''
    elif task.state == 'FAILURE':
        response_data['error'] = str(task.info)
        
    return JsonResponse(response_data)




@login_required
def get_folder_attachments(request, folder_id):
    try:
        folder = Folder.objects.get(id=folder_id, user=request.user)
        rule = Rule.objects.filter(folder=folder).first()
        attachments = Attachment.objects.filter(
            folder=folder,
            user=request.user
        ).order_by("-created_at")

        data = []
        for file in attachments:
            # Get file size from disk
            try:
                file_size = os.path.getsize(file.encrypted_file_path)
            except OSError:
                file_size = 0

            data.append({
                "id": file.id,
                "name": file.original_filename,
                "path": file.encrypted_file_path,
                "date": timezone.localtime(file.created_at).strftime("%d-%m-%Y %H:%M"),
                "date_raw": timezone.localtime(file.created_at).isoformat(),
                "sender": file.sender_email,
                "size": file_size
            })

        rule_data = None

        if rule:
            rule_data = {
             "sender_email": rule.sender_email,
             "domain": rule.domain,
             "file_type": rule.file_type
           }

        return JsonResponse({
            "success": True,
            "files": data,
            "rule": rule_data
        })

    except Folder.DoesNotExist:
        return JsonResponse({"error": "Folder not found"}, status=404)

@login_required
def download_attachment(request, file_id):
    try:
        file = Attachment.objects.get(id=file_id, user=request.user)
        
        with open(file.encrypted_file_path, "rb") as f:
            file_data = f.read()
            
        try:
            # Try decrypting
            final_data = FileEncryption.decrypt(file_data, request.user.id)
        except Exception:
            # Fallback for old unencrypted files
            final_data = file_data
        
        return FileResponse(
            io.BytesIO(final_data),
            as_attachment=True,
            filename=file.original_filename
        )

    except Attachment.DoesNotExist:
        return JsonResponse({"error": "File not found"}, status=404)
    except Exception as e:
        print(f"[Download Error] {e}")
        return JsonResponse({"error": "Failed to decrypt or read file"}, status=500)

@login_required
@xframe_options_sameorigin
def preview_attachment(request, file_id):
    try:
        file = Attachment.objects.get(id=file_id, user=request.user)

        with open(file.encrypted_file_path, "rb") as f:
            file_data = f.read()
            
        try:
            # Try decrypting
            final_data = FileEncryption.decrypt(file_data, request.user.id)
        except Exception:
            # Fallback for old unencrypted files
            final_data = file_data

        # Detect content type for preview
        ext = file.original_filename.lower().split('.')[-1]
        content_types = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'txt': 'text/plain',
        }
        content_type = content_types.get(ext, 'application/octet-stream')

        return FileResponse(
            io.BytesIO(final_data),
            as_attachment=False,
            filename=file.original_filename,
            content_type=content_type
        )

    except Attachment.DoesNotExist:
        return JsonResponse({"error": "File not found"}, status=404)
    except Exception as e:
        print(f"[Preview Error] {e}")
        return JsonResponse({"error": "Failed to decrypt or read file"}, status=500)

@login_required
@require_POST
def set_passkey(request):

    if not request.session.get("otp_verified"):
        return JsonResponse({"error": "OTP verification required"}, status=403)

    data = json.loads(request.body)

    passkey = data.get("passkey", "").strip()

    if not passkey:
        return JsonResponse({"error": "Passkey required"}, status=400)

    hashed = make_password(passkey)

    obj, _ = Passkey.objects.get_or_create(user=request.user)

    obj.passkey_hash = hashed
    obj.save()

    request.session.pop("otp_verified", None)

    return JsonResponse({"success": True})

@login_required
@require_POST
def verify_passkey(request):
    try:
        data = json.loads(request.body)
        passkey = data.get("passkey", "").strip()

        passkey_obj = Passkey.objects.filter(user=request.user).first()

        if not passkey_obj:
            return JsonResponse({"error": "Passkey not set"}, status=400)


        if check_password(passkey, passkey_obj.passkey_hash):
            return JsonResponse({"success": True})
        else:
            return JsonResponse({"error": "Incorrect passkey"}, status=403)

    except Exception as e:
        print("PASSKEY ERROR:", e)
        return JsonResponse({"error": "Passkey verification failed"}, status=500)

@login_required
@require_POST
def send_passkey_otp(request):

    otp = random.randint(100000, 999999)

    request.session["passkey_otp"] = str(otp)
    request.session["otp_time"] = time.time()

    send_mail(
        "MailFlow Passkey OTP",
        f"Your OTP for setting passkey is {otp}",
        settings.EMAIL_HOST_USER,
        [request.user.email],
    )

    return JsonResponse({"success": True})

@login_required
@require_POST
def verify_passkey_otp(request):

    try:
        data = json.loads(request.body)
        user_otp = data.get("otp", "").strip()

        session_otp = request.session.get("passkey_otp")
        otp_time = request.session.get("otp_time")


        if not session_otp or not otp_time:
            return JsonResponse({"error": "OTP not requested"}, status=400)

        # expiry check
        if time.time() - otp_time > 180:
            request.session.pop("passkey_otp", None)
            request.session.pop("otp_time", None)
            return JsonResponse({"error": "OTP expired"}, status=403)

        if user_otp != session_otp:
            return JsonResponse({"error": "Invalid OTP"}, status=403)

        # success
        request.session["otp_verified"] = True

        request.session.pop("passkey_otp", None)
        request.session.pop("otp_time", None)

        return JsonResponse({"success": True})

    except Exception as e:
        print("OTP VERIFY ERROR:", e)
        return JsonResponse({"error": "Server error"}, status=500)

@login_required
@require_POST
def delete_attachment(request, file_id):
    try:
        file = Attachment.objects.get(id=file_id, user=request.user)
        if os.path.exists(file.encrypted_file_path):
            os.remove(file.encrypted_file_path)
        file.delete()
        return JsonResponse({"success": True})
    except Attachment.DoesNotExist:
        return JsonResponse({"error": "File not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
