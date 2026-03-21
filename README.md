MailFlow — Email Attachment Extractor & Auto Folder System
📌 Project Description

MailFlow is a web-based application designed to automatically retrieve email attachments and organize them into structured folders. The system integrates with Gmail using secure Google OAuth2 authentication and IMAP, allowing users to access their emails without storing passwords.

Attachments from unread emails are extracted automatically and organized into user-created folders based on rules such as sender email, domain name, and file type. This eliminates the need for manual downloading and sorting of attachments.

For security, each file is scanned using antivirus protection and then encrypted before storage. Encrypted files are stored on the server’s local disk, while only metadata (file details) is stored in the MySQL database. The system also supports file preview and secure download features. Background processing is implemented to ensure smooth performance during extraction.

🛠 Technologies Used

Python

Django Framework

HTML

CSS

JavaScript

MySQL Database

Celery

Redis

Google OAuth2

IMAP Protocol

ClamAV Antivirus

AES Encryption

👩‍🎓 Student Details

Name: Maria Gasper
Programme: Integrated MCA
Semester: S10 IMCA
Institution: Saintgits College of Engineering

Email: mariagasper10@gmail.com

👨‍🏫 Project Guide

Guide Name: MR. Gopeekrishnan R

👨‍🏫 Project Co-ordinator

Co-ordinator Name: Dr. Jijo Varghese

🚀 Project Status

Working version completed with core functionalities including:

Secure Gmail login

Automated attachment extraction

Rule-based folder organization

Encrypted file storage

File preview and download

Background processing

Anti virus scanning