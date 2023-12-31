# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, http
from odoo.http import request

from odoo.addons.website_sale_product_configurator.controllers.main import WebsiteSaleProductConfiguratorController


class RentingConfiguratorController(WebsiteSaleProductConfiguratorController):

    @http.route()
    def show_advanced_configurator_website(self, *args, **kw):
        """Special route to use website logic in get_combination_info override.
        This route is called in JS by appending _website to the base route.
        """
        if request.env.context.get('start_date') and request.env.context.get('end_date'):
            request.update_context(
                start_date=fields.Datetime.to_datetime(request.env.context['start_date']),
                end_date=fields.Datetime.to_datetime(request.env.context['end_date']),
            )
        return super().show_advanced_configurator_website(*args, **kw)
