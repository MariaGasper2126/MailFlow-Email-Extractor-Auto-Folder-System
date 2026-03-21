from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("create-folder/", views.create_folder, name="create_folder"),
    path("rename-folder/<int:folder_id>/", views.rename_folder, name="rename_folder"),
    path("delete-folder/<int:folder_id>/", views.delete_folder, name="delete_folder"),
    path("extract/", views.extract_emails, name="extract_emails"),
    path("task-status/<str:task_id>/", views.get_task_status, name="task_status"),
    path("logout/", views.logout_view, name="logout"),

    path("download/<int:file_id>/", views.download_attachment, name="download_attachment"),
    path("preview/<int:file_id>/", views.preview_attachment, name="preview_attachment"),

    path("set-passkey/", views.set_passkey, name="set_passkey"),
    path("verify-passkey/", views.verify_passkey, name="verify_passkey"),
    path("send-passkey-otp/", views.send_passkey_otp, name="send_passkey_otp"),
    path("verify-passkey-otp/", views.verify_passkey_otp, name="verify_passkey_otp"),

    path("folder/<int:folder_id>/attachments/", views.get_folder_attachments, name="folder_attachments"),
    path("delete-attachment/<int:file_id>/", views.delete_attachment, name="delete_attachment"),
]