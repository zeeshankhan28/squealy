import os
import dj_database_url
try:
    import urlparse
except ImportError:
    import urllib.parse as urlparse



def extract_dj_database_urls(databases_as_string, DATABASES):
    '''
    Expects a string comma separated by dj_database_urls.
    Returns an object which contains details of all the databases
    entered by the user before deployment
    '''
    if databases_as_string:
        databases_as_array = [db.strip() for db in databases_as_string.split(',')]
        for db in databases_as_array:
            database_type = db.split(":")[0].strip()
            if database_type == 'mssql':
                db_config = {}
                db_config['ENGINE'] = 'sql_server.pyodbc'
                url = urlparse.urlparse(db)
                path = url.path[1:]
                netloc = url.netloc
                if "@" in netloc:
                    netloc = netloc.rsplit("@", 1)[1]
                if ":" in netloc:
                    netloc = netloc.split(":", 1)[0]
                hostname = netloc or ''
                if '%2f' in hostname.lower():
                    hostname = hostname.replace('%2f', '/').replace('%2F', '/')
                db_config.update({
                    'NAME': 'MSSQL',
                    'DBNAME': urlparse.unquote(path or ''),
                    'USER': urlparse.unquote(url.username or ''),
                    'PASSWORD': urlparse.unquote(url.password or ''),
                    'HOST': hostname,
                    'PORT': url.port or '',
                })
            else:
                db_config = dj_database_url.parse(db, conn_max_age=500)
            if database_type == 'postgres':
                if 'OPTIONS' not in db_config:
                    db_config['OPTIONS'] = {'options': ''}
                db_config['OPTIONS']['options'] = '-c default_transaction_read_only=on'
            display_name = db_config['NAME']
            if db_config.get('OPTIONS') and db_config['OPTIONS'].get('display_name'):
                display_name = db_config['OPTIONS'].get('display_name')
                del db_config['OPTIONS']['display_name']
            DATABASES[display_name] = db_config
        del DATABASES['query_db']
