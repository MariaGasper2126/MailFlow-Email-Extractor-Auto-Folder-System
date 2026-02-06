# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("verify-otp/", views.verify_otp, name="verify_otp"),
    path("resend-otp/", views.resend_otp, name="resend_otp"),
    path("login/", views.login, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("create-folder/", views.create_folder, name="create_folder"),
    
    path("rename-folder/<int:folder_id>/", views.rename_folder, name="rename_folder"),
    path('delete-folder/<int:folder_id>/', views.delete_folder, name='delete_folder'),
    path("forgot-password/", views.forgot_password, name="forgot_password"),
    path("verify-recovery/", views.verify_recovery, name="verify_recovery"),
    path("verify-recovery-otp/", views.verify_recovery_otp, name="verify_recovery_otp"),
    path("reset-password/", views.reset_password, name="reset_password"),
    path("forgot-password/send-otp/", views.forgot_password_send_otp, name="forgot_password_send_otp"),
]