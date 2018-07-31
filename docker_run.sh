#!/bin/bash
python manage.py makemigrations
python manage.py migrate
python manage.py runserver 0.0.0.0:8001 & python manage.py celery worker && kill $!