from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


ERROR_CODE_BY_STATUS = {
    status.HTTP_400_BAD_REQUEST: 40000,
    status.HTTP_401_UNAUTHORIZED: 40100,
    status.HTTP_403_FORBIDDEN: 40101,
    status.HTTP_404_NOT_FOUND: 40400,
    status.HTTP_405_METHOD_NOT_ALLOWED: 40002,
    status.HTTP_409_CONFLICT: 40900,
    status.HTTP_422_UNPROCESSABLE_ENTITY: 42200,
    status.HTTP_500_INTERNAL_SERVER_ERROR: 50000,
    status.HTTP_503_SERVICE_UNAVAILABLE: 50020,
}


def request_id_from_context(context):
    request = context.get("request") if context else None
    return getattr(request, "request_id", "")


def normalize_error_data(exc, response):
    if isinstance(exc, exceptions.ValidationError):
        return {"field_errors": response.data}
    if isinstance(response.data, dict):
        return response.data
    if response.data:
        return {"detail": response.data}
    return {}


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        if isinstance(exc, Http404):
            response = Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            response = Response(
                {"detail": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    code = ERROR_CODE_BY_STATUS.get(response.status_code)
    if code is None:
        code = 50000 if response.status_code >= 500 else 40000

    message = "参数校验失败" if isinstance(exc, exceptions.ValidationError) else str(exc)
    if not message or message == "None":
        message = response.status_text

    response.data = {
        "code": code,
        "message": message,
        "data": normalize_error_data(exc, response),
        "request_id": request_id_from_context(context),
    }
    return response
