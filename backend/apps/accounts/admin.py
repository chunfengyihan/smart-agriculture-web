from django.contrib import admin

from .models import WeChatUserProfile


@admin.register(WeChatUserProfile)
class WeChatUserProfileAdmin(admin.ModelAdmin):
    list_display = ("openid", "user", "role", "unionid", "last_login_at", "updated_at")
    list_filter = ("role",)
    search_fields = ("openid", "unionid", "user__username", "nickname")
    readonly_fields = ("session_key_hash", "created_at", "updated_at", "last_login_at")
