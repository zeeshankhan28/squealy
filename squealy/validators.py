from jinjasql import JinjaSql
from django.db import connections
#import pyodbc
from squealy.exceptions import ValidationFailedException
import os
from pyathenajdbc import connect
jinjasql = JinjaSql()


def run_validation(params, user, query, db, error_message="Validation Failed"):
    query, bind_params = jinjasql.prepare_query(query, {"params": params, 'user': user})
    conn = connections[db]

    if conn.settings_dict['NAME'] == 'Athena':
        conn = connect(
            driver_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'athena-jdbc/AthenaJDBC41-1.0.0.jar'))
    # elif conn.settings_dict['NAME'] == 'MSSQL':
    #     hostname = conn.settings_dict['HOST']
    #
    #     username = conn.settings_dict['USER']
    #     password = conn.settings_dict['PASSWORD']
    #     port = conn.settings_dict['PORT']
    #     dbname = conn.settings_dict['DBNAME']
    #     conn = pyodbc.connect(
    #         "DRIVER={ODBC Driver 17 for SQL SERVER};SERVER=" + hostname + ";PORT=" + str(
    #             port) + ";DATABASE=" + dbname + ";UID=" + username + ";PWD=" + password)
    #
    #     query = query.replace("%s", "?")
    with conn.cursor() as cursor:
        cursor.execute(query, bind_params)
        data = cursor.fetchall()
        if len(data) <= 0:
            raise ValidationFailedException(detail=error_message)
