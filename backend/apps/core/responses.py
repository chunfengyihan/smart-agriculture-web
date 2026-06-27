from rest_framework.response import Response


def success_response(request, data=None, message="success", status_code=200):
    return Response(
        {
            "code": 0,
            "message": message,
            "data": data if data is not None else {},
            "request_id": getattr(request, "request_id", ""),
        },
        status=status_code,
    )
