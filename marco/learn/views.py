# Create your views here.
from django.shortcuts import get_object_or_404, render_to_response
from django.template import RequestContext
from data_manager.models import *
from utils import get_domain
import settings


def learn_page(request, theme_name=None, template='theme_page.html'):
    theme = get_object_or_404(Theme, name = theme_name)
    theme.layers = theme.layer_set.all().order_by('name')
    context = {'theme': theme, 'domain': get_domain(8000), 'domain8010': get_domain()}
    return render_to_response(template, RequestContext(request, context)) 

def get_ordered_list():
    themes = Theme.objects.all().order_by('display_name')
    theme_list = []
    for theme in themes:
        layers = theme.layer_set.all().order_by('name')
        theme_list.append((theme, layers))
    return theme_list
    
def add_learn_links(themes):
    context = []
    for theme in themes:
        context.append({'theme': theme, 'learn_link': theme.learn_link})
    return context
    
def linkify(text):
    return text.lower().replace(' ', '-')
    
