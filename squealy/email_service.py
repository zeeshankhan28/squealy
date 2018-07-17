import json
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from django.template import Template, Context
from selenium import webdriver

from .exceptions import SMTPException, EmailRecipientException, EmailSubjectException
from .models import ScheduledReport, ScheduledReportChart, \
    ReportParameter, ReportRecipient
from .views import DataProcessor


def check_smtp_credentials():
    """
        This method checks if the user has provided the SMTP credentials or not
    """
    return settings.EMAIL_HOST and settings and settings.EMAIL_HOST and\
        settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD


class ScheduledReportConfig(object):

    def __init__(self, scheduled_report):
        """
            Expects a scheduled report object and inititializes
            its own scheduled_report attribute with it
        """
        self.scheduled_report = scheduled_report

    def get_report_config(self):
        """
            Returns the configuration related to a scheduled report, needed
            to populate the email
        """
        return {
                "template_context": self._get_related_charts_data(),
                "recipients": self._get_report_recipients()
                }

    def _get_report_recipients(self):
        """
            Returns the recipient list for a scheduled report
        """
        return list(ReportRecipient.objects.filter(report=self.scheduled_report)\
                    .values_list('email', flat=True))

    def _get_report_parameters(self):
        """
            Returns the query parameters for a scheduled report
        """
        report_parameters = ReportParameter.objects.\
            filter(report=self.scheduled_report)

        param_dict = {}

        for parameter in report_parameters:
            param_dict[parameter.parameter_name] = parameter.parameter_value

        return param_dict

    def _get_related_charts_data(self):
        """
            Returns the data needed to populate the reports
            mapped with a scheduled report
        """
        related_charts_data = {
            "charts": []
        }

        filtered_scheduled_reports = ScheduledReportChart.objects.\
            filter(report=self.scheduled_report)
        report_parameters = self._get_report_parameters()
        for report in filtered_scheduled_reports:
            chart_type = report.chart.type
            chart_data = DataProcessor().\
                fetch_chart_data(report.chart.url, report_parameters, None)
            related_charts_data['charts'].append(
                {"data": chart_data, "name": report.chart.name, 'chart_type':chart_type}
            )

        return related_charts_data


def create_email_data(content=None):
    if not content: content = "{% include 'report.html' %}"
    content = '''
    <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Title</title>
        </head>
        <body> ''' + str(content) + '''</body></html>'''
    return content


def create_email_chart(data_list=None, name=None, type=None):
    content = '''
    <!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <title>Title</title>
    </head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>

    <script type="text/javascript">
        // Load google charts
        google.charts.load('current', {
            'packages': ['corechart']
        });
        google.charts.setOnLoadCallback(drawChart);

        // Draw the chart and set the chart values
        function drawChart() {
            var data = new google.visualization.DataTable('''+data_list+''');

            // Display the chart inside the <div> element with id="piechart"
            var chart = new google.visualization.'''+type+'''(document.getElementById('chart'));
            chart.draw(data);
        }
    </script>

    <body>
    '''+name+'''
        <div id="chart"></div>
    </body>

    </html>'''
    return content


class MyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (bytes, bytearray)):
            return obj.decode("ASCII") # <- or any other encoding of your choice
        # Let the base class default method raise the TypeError
        return json.JSONEncoder.default(self, obj)


def send_emails():
    if check_smtp_credentials():
        email_from = settings.EMAIL_HOST_USER
        current_time = datetime.utcnow()
        scheduled_reports = ScheduledReport.objects.filter(next_run_at__range=(current_time + timedelta(days=-1), current_time + timedelta(days=1)))
        # TODO: Try to reduce the db queries here

        mail_server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
        mail_server.starttls()
        mail_server.login(email_from, settings.EMAIL_HOST_PASSWORD)

        for scheduled_report in scheduled_reports:
            report_config = ScheduledReportConfig(scheduled_report).\
                get_report_config()
            charts = report_config['template_context']['charts']
            template = Template(create_email_data(scheduled_report.template))
            report_template = ""
            recipients = report_config['recipients']

            msg_root = MIMEMultipart('related')
            msg_root['Subject'] = scheduled_report.subject
            msg_root['From'] = email_from
            msg_root['To'] = ' '.join(recipients)
            msg_alternative = MIMEMultipart('alternative')
            msg_root.attach(msg_alternative)
            msg_text = MIMEText(scheduled_report.subject)
            msg_alternative.attach(msg_text)

            for i, chart in enumerate(charts):
                if chart['chart_type'] == "Table":
                    report_template += template.render(Context({'chart': chart}))
                else:
                    report_template += '<br><img src="cid:image'+str(i)+'"><br>'
                    html = create_email_chart(json.dumps(chart['data'], cls=MyEncoder), chart['name'], \
                                              chart['chart_type'])

                    fh = open("hello.html", "w")
                    fh.write(str(html))
                    fh.close()

                    driver = webdriver.PhantomJS()
                    driver.get("hello.html")
                    time.sleep(5)
                    driver.save_screenshot('screen.png')
                    fp = open('screen.png', 'rb')
                    msg_image = MIMEImage(fp.read())
                    fp.close()

                    # Define the image's ID as referenced above
                    msg_image.add_header('Content-ID', '<image'+str(i)+'>')
                    msg_root.attach(msg_image)

            scheduled_report.save()
            msg_text = MIMEText(report_template, 'html')
            msg_alternative.attach(msg_text)

            if not scheduled_report.subject:
                raise EmailSubjectException('Subject not provided for scheduled report %s' % scheduled_report.id)
            if not report_config['recipients']:
                raise EmailRecipientException('Recipients not provided for scheduled report %s' % (scheduled_report.id))

            mail_server.sendmail(email_from, recipients, msg_root.as_string())

        mail_server.quit()

    else:
        raise SMTPException('Please specify the smtp credentials to use the scheduled reports service')

