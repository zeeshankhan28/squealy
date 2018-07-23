#!/bin/bash
python manage.py makemigrations
python manage.py migrate
python manage.py celery worker --beat --loglevel=info --without-gossip --without-mingle --without-heartbeat & python manage.py runserver 0.0.0.0:8001 && kill $!
