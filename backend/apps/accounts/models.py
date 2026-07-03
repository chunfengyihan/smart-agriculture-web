from django.conf import settings
from django.db import models


class WeChatUserProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_OPERATOR = "operator"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_OPERATOR, "Operator"),
        (ROLE_VIEWER, "Viewer"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wechat_profile",
    )
    openid = models.CharField(max_length=128, unique=True)
    unionid = models.CharField(max_length=128, blank=True, db_index=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_VIEWER, db_index=True)
    nickname = models.CharField(max_length=128, blank=True)
    session_key_hash = models.CharField(max_length=64, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["openid"]),
            models.Index(fields=["role"]),
        ]
        ordering = ["openid"]

    def __str__(self):
        return f"{self.openid} ({self.role})"
