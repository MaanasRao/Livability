from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Report

# Simple Serializer (Manual, to save creating another file)
def serialize_report(report):
    return {
        "id": report.id,
        "title": report.title,
        "description": report.description,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "created_at": report.created_at
    }

@api_view(['GET', 'POST'])
def report_list(request):
    if request.method == 'GET':
        reports = Report.objects.all()
        data = [serialize_report(r) for r in reports]
        return Response(data)

    elif request.method == 'POST':
        data = request.data
        report = Report.objects.create(
            title=data.get('title', 'Untitled'),
            description=data.get('description', ''),
            latitude=data.get('latitude', 0.0),
            longitude=data.get('longitude', 0.0)
        )
        return Response(serialize_report(report))