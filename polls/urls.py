from django.urls import path
from django.views.generic import TemplateView

from . import views

app_name = 'polls'
urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),
    path('<int:pk>/', views.DetailView.as_view(), name='detail'),
    path('<int:pk>/results/', views.ResultsView.as_view(), name='results'),
    path('<int:question_id>/vote/', views.vote, name='vote'),
    path('offline/', views.offline, name='offline'),
    path('sw.js', (
        TemplateView.as_view(
            template_name="polls/sw.js",
            content_type='application/javascript')), name='sw.js'),
    path('get_csrftoken_from_cookie', views.get_csrftoken_from_cookie,
         name='get_csrftoken_from_cookie')
]
