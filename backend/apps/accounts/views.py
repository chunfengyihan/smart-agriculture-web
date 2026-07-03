from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.responses import error_response, success_response

from .serializers import (
    LogoutRequestSerializer,
    LogoutResponseSerializer,
    RefreshResponseSerializer,
    RefreshRequestSerializer,
    TokenPairSerializer,
    UserSerializer,
    WeChatLoginRequestSerializer,
    serialize_user,
)
from .services import (
    WeChatCodeExchangeError,
    WeChatLoginConfigError,
    exchange_code_for_session,
    get_or_create_user_for_wechat_session,
)


def token_pair_for_user(user):
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)
    return {
        "access": access,
        "refresh": str(refresh),
        "token": access,
        "user": serialize_user(user),
    }


class WeChatLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        request=WeChatLoginRequestSerializer,
        responses={
            200: TokenPairSerializer,
            400: OpenApiResponse(description="Invalid code or WeChat rejected the login code"),
            503: OpenApiResponse(description="WeChat credentials are not configured"),
        },
    )
    def post(self, request):
        serializer = WeChatLoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            wechat_session = exchange_code_for_session(serializer.validated_data["code"])
            user, _profile = get_or_create_user_for_wechat_session(wechat_session)
        except WeChatLoginConfigError as exc:
            return error_response(
                request,
                code=50030,
                message=str(exc),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except WeChatCodeExchangeError as exc:
            return error_response(
                request,
                code=40010,
                message=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(request, token_pair_for_user(user))


class RefreshTokenView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(request=RefreshRequestSerializer, responses={200: RefreshResponseSerializer})
    def post(self, request):
        serializer = RefreshRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            refresh = RefreshToken(serializer.validated_data["refresh"])
            access = str(refresh.access_token)
        except TokenError as exc:
            return error_response(
                request,
                code=40102,
                message="Refresh token is invalid or expired",
                data={"detail": str(exc)},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        return success_response(
            request,
            {
                "access": access,
                "token": access,
            },
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutRequestSerializer, responses={200: LogoutResponseSerializer})
    def post(self, request):
        serializer = LogoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError as exc:
            return error_response(
                request,
                code=40102,
                message="Refresh token is invalid or expired",
                data={"detail": str(exc)},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        return success_response(request, {"logged_out": True})


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        return success_response(request, serialize_user(request.user))
