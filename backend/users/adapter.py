import uuid
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model


class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom adapter that generates a unique username from the Google email
    so that multiple Google accounts can all sign up without hitting the
    unique-username constraint on auth_user.
    """

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)

        # If allauth left the username blank (email-only mode), derive one
        # from the email address and make it unique.
        if not user.username:
            email = data.get("email") or ""
            base = email.split("@")[0][:28] or "user"  # type: ignore[index]  # keep it short

            User = get_user_model()
            username = base
            # Keep appending a short uuid chunk until we find a free slot
            while User.objects.filter(username=username).exists():
                username = f"{base}_{uuid.uuid4().hex[:6]}"  # type: ignore[index]

            user.username = username

        return user
