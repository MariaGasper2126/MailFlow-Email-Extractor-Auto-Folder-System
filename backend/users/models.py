from django.db import models
from django.contrib.auth.models import User

class User(models.Model):
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    mobile_number = models.CharField(max_length=10)
    date_of_birth = models.DateField()
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.email

class OTP(models.Model):
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.email} - {self.otp}"

class Folder(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE,related_name="folders")
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.name

