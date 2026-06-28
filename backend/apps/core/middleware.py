import re
import uuid


REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        provided_request_id = (request.headers.get("X-Request-ID") or "").strip()
        request.request_id = (
            provided_request_id if REQUEST_ID_PATTERN.fullmatch(provided_request_id) else str(uuid.uuid4())
        )
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
