from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User, OTP
import random
from django.contrib.auth.hashers import make_password
from django.shortcuts import render, redirect
from .models import OTP
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from .models import Folder
import json
from django.views.decorators.http import require_POST

@csrf_exempt
def register(request):

    if request.method == 'GET':
        return render(request, 'users/register.html')

    if request.method == 'POST':

        #  cleanup expired OTPs + unverified users
        expired_otps = OTP.objects.filter(
            created_at__lt=timezone.now() - timedelta(minutes=5)
        )

        for otp in expired_otps:
            User.objects.filter(email=otp.email, is_verified=False).delete()
            otp.delete()

        email = request.POST.get('email')
        password = request.POST.get('password')
        mobile = request.POST.get('mobile')
        dob = request.POST.get('dob')

        #  block duplicate email (ANY user)
        if User.objects.filter(email=email).exists():
            return JsonResponse(
                {'error': 'Email already registered'},
                status=400
            )

        #  create temp user
        user = User.objects.create(
            email=email,
            password=make_password(password),
            mobile_number=mobile,
            date_of_birth=dob,
            is_verified=False
        )

        #  generate OTP
        otp_code = str(random.randint(100000, 999999))

        #  save OTP
        OTP.objects.create(
            email=email,
            otp=otp_code
        )

        #  send OTP to email
        send_mail(
            subject="MailFlow OTP Verification",
            message=f"Your OTP is {otp_code}. It is valid for 5 minutes.",
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )

        return JsonResponse(
            {"message": "OTP sent successfully"},
            status=200
        )

@csrf_exempt
def verify_otp(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")
    otp_input = request.POST.get("otp")

    if not email or not otp_input:
        return JsonResponse({"error": "OTP not provided"}, status=400)

    try:
        otp_obj = OTP.objects.get(email=email, otp=otp_input)

        if timezone.now() - otp_obj.created_at > timedelta(minutes=5):
            otp_obj.delete()
            return JsonResponse({"error": "OTP expired"}, status=400)

        user = User.objects.get(email=email)
        user.is_verified = True
        user.save()

        otp_obj.delete()

        return JsonResponse({"message": "OTP verified successfully"}, status=200)

    except OTP.DoesNotExist:
        return JsonResponse({"error": "Invalid OTP"}, status=400)



@csrf_exempt
def resend_otp(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")

    if not email:
        return JsonResponse({"error": "Email required"}, status=400)

    try:
        user = User.objects.get(email=email)

        if user.is_verified:
            return JsonResponse({"error": "User already verified"}, status=400)

        #  delete old OTPs
        OTP.objects.filter(email=email).delete()

        #  generate new OTP
        new_otp = str(random.randint(100000, 999999))

        # save OTP
        OTP.objects.create(
            email=email,
            otp=new_otp
        )

        #  send OTP to email
        send_mail(
            subject="Your New OTP Verification Code",
            message=f"Your new OTP is {new_otp}. It is valid for 5 minutes.",
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )

        return JsonResponse({"message": "New OTP sent successfully"}, status=200)

    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)


@csrf_exempt
def login(request):
    if request.method == "GET":
        return render(request, "users/login.html")

    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

        if not user.is_verified:
            return JsonResponse(
                {"error": "Please verify your email before login"},
                status=403
            )

        if not check_password(password, user.password):
            return JsonResponse({"error": "Invalid password"}, status=400)

        # ✅ SESSION STORE (THIS LINE WAS BREAKING DUE TO INDENTATION)
        request.session["user_email"] = user.email

        return JsonResponse({"message": "Login successful"}, status=200)

@csrf_exempt
def logout_view(request):
    if "user_email" in request.session:
        del request.session["user_email"]
    return JsonResponse({"message": "Logged out successfully"}, status=200)

@csrf_exempt
def forgot_password(request):
    if request.method == "GET":
        return render(request, "users/forgot_password.html")



@csrf_exempt
def verify_recovery(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")
    dob = request.POST.get("dob")

    if not email or not dob:
        return JsonResponse({"error": "Email and DOB required"}, status=400)

    try:
        user = User.objects.get(
            email=email,
            date_of_birth=dob   # 🔥 THIS is the key line
        )

        return JsonResponse(
            {"success": True, "message": "User verified"},
            status=200
        )

    except User.DoesNotExist:
        return JsonResponse(
            {"error": "Email and date of birth don't match our records"},
            status=400
        )

@csrf_exempt
def forgot_password_send_otp(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")
    dob = request.POST.get("dob")

    try:
        user = User.objects.get(email=email, date_of_birth=dob)

        OTP.objects.filter(email=email).delete()

        otp_code = str(random.randint(100000, 999999))
        OTP.objects.create(email=email, otp=otp_code)

        send_mail(
            subject="MailFlow Password Reset OTP",
            message=f"Your password reset OTP is {otp_code}. It is valid for 5 minutes.",
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )

        return JsonResponse({"success": True})

    except User.DoesNotExist:
        return JsonResponse(
            {"error": "Email and date of birth do not match"},
            status=400
        )

@csrf_exempt
def verify_recovery_otp(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")
    otp_input = request.POST.get("otp")

    if not email or not otp_input:
        return JsonResponse({"error": "Email and OTP required"}, status=400)

    try:
        otp_obj = OTP.objects.get(email=email, otp=otp_input)

        # check expiry
        if timezone.now() - otp_obj.created_at > timedelta(minutes=5):
            otp_obj.delete()
            return JsonResponse({"error": "OTP expired"}, status=400)

        # OTP valid → allow reset
        otp_obj.delete()

        return JsonResponse({"success": True})

    except OTP.DoesNotExist:
        return JsonResponse({"error": "Invalid OTP"}, status=400)

@csrf_exempt
def reset_password(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    email = request.POST.get("email")
    new_password = request.POST.get("new_password")
    confirm_password = request.POST.get("confirm_password")

    if not email or not new_password or not confirm_password:
        return JsonResponse({"error": "All fields required"}, status=400)

    if new_password != confirm_password:
        return JsonResponse({"error": "Passwords do not match"}, status=400)

    try:
        user = User.objects.get(email=email)

        # 🔐 hash password
        user.password = make_password(new_password)
        user.save()

        # 🧹 cleanup OTPs
        OTP.objects.filter(email=email).delete()

        return JsonResponse({"success": True, "message": "Password reset successful"})

    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)


@csrf_exempt
@login_required
def create_folder(request):
    if request.method == "POST":
        data = json.loads(request.body)
        folder_name = data.get("folder_name")

        if not folder_name:
            return JsonResponse({"error": "Folder name required"}, status=400)

        email = request.session.get("user_email")

        if not email:
            return JsonResponse({"error": "Not logged in"}, status=403)

        try:
            custom_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

        Folder.objects.create(
            user=custom_user,
            name=folder_name
        )1

        return JsonResponse({"message": "Folder created successfully"})

    return JsonResponse({"error": "Invalid request"}, status=405)

@login_required
def dashboard(request):
    email = request.session.get("user_email")

    if not email:
        return redirect("login")

    try:
        custom_user = User.objects.get(email=email)
    except User.DoesNotExist:
        return redirect("login")

    folders = Folder.objects.filter(user=custom_user)

    return render(request, "users/dashboard.html", {
        "folders": folders,
        "user_email": email
    })


@require_POST
@login_required
def rename_folder(request, folder_id):  # ✅ folder_id comes from URL now
    try:
        data = json.loads(request.body)
        new_name = data.get("name")  # ✅ Changed from "new_name" to "name"
        
        if not new_name:
            return JsonResponse({"error": "New name required"}, status=400)
        
        # Get user from session (consistent with your other views)
        email = request.session.get("user_email")
        if not email:
            return JsonResponse({"error": "Not logged in"}, status=403)
            
        user = User.objects.get(email=email)
        folder = Folder.objects.get(id=folder_id, user=user)
        
        folder.name = new_name
        folder.save()
        
        return JsonResponse({"success": True, "message": "Folder renamed successfully"})
        
    except Folder.DoesNotExist:
        return JsonResponse({"error": "Folder not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_POST
@login_required  # ✅ Added login_required
def delete_folder(request, folder_id):
    try:
        # Get user from session (consistent with your other views)
        email = request.session.get("user_email")
        if not email:
            return JsonResponse({"error": "Not logged in"}, status=403)
            
        user = User.objects.get(email=email)
        folder = Folder.objects.get(id=folder_id, user=user)
        
        folder_name = folder.name
        folder.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Folder "{folder_name}" deleted successfully'
        })
        
    except Folder.DoesNotExist:
        return JsonResponse({
            'error': 'Folder not found or you do not have permission'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=500)