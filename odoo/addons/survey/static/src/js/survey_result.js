odoo.define('survey.result', function (require) {
'use strict';

var _t = require('web.core')._t;
const { loadJS } = require('@web/core/assets');
var publicWidget = require('web.public.widget');

// The given colors are the same as those used by D3
var D3_COLORS = ["#1f77b4","#ff7f0e","#aec7e8","#ffbb78","#2ca02c","#98df8a","#d62728",
                    "#ff9896","#9467bd","#c5b0d5","#8c564b","#c49c94","#e377c2","#f7b6d2",
                    "#7f7f7f","#c7c7c7","#bcbd22","#dbdb8d","#17becf","#9edae5"];

// TODO awa: this widget loads all records and only hides some based on page
// -> this is ugly / not efficient, needs to be refactored
publicWidget.registry.SurveyResultPagination = publicWidget.Widget.extend({
    events: {
        'click li.o_survey_js_results_pagination a': '_onPageClick',
    },

    //--------------------------------------------------------------------------
    // Widget
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {$.Element} params.questionsEl The element containing the actual questions
     *   to be able to hide / show them based on the page number
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.$questionsEl = params.questionsEl;
    },

    /**
     * @override
     */
    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.limit = self.$el.data("record_limit");
        });
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onPageClick: function (ev) {
        ev.preventDefault();
        this.$('li.o_survey_js_results_pagination').removeClass('active');

        var $target = $(ev.currentTarget);
        $target.closest('li').addClass('active');
        this.$questionsEl.find('tbody tr').addClass('d-none');

        var num = $target.text();
        var min = (this.limit * (num-1))-1;
        if (min === -1){
            this.$questionsEl.find('tbody tr:lt('+ this.limit * num +')')
                .removeClass('d-none');
        } else {
            this.$questionsEl.find('tbody tr:lt('+ this.limit * num +'):gt(' + min + ')')
                .removeClass('d-none');
        }

    },
});

/**
 * Widget responsible for the initialization and the drawing of the various charts.
 *
 */
publicWidget.registry.SurveyResultChart = publicWidget.Widget.extend({
    jsLibs: [
        '/web/static/lib/Chart/Chart.js',
    ],

    //--------------------------------------------------------------------------
    // Widget
    //--------------------------------------------------------------------------

    /**
     * Initializes the widget based on its defined graph_type and loads the chart.
     *
     * @override
     */
    start: function () {
        var self = this;

        return this._super.apply(this, arguments).then(function () {
            self.graphData = self.$el.data("graphData");
            self.rightAnswers = self.$el.data("rightAnswers") || [];

            if (self.graphData && self.graphData.length !== 0) {
                switch (self.$el.data("graphType")) {
                    case 'multi_bar':
                        self.chartConfig = self._getMultibarChartConfig();
                        break;
                    case 'bar':
                        self.chartConfig = self._getBarChartConfig();
                        break;
                    case 'pie':
                        self.chartConfig = self._getPieChartConfig();
                        break;
                    case 'doughnut':
                        self.chartConfig = self._getDoughnutChartConfig();
                        break;
                    case 'by_section':
                        self.chartConfig = self._getSectionResultsChartConfig();
                        break;
                }

                self._loadChart();
            }
        });
    },

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * Returns a standard multi bar chart configuration.
     *
     * @private
     */
    _getMultibarChartConfig: function () {
        return {
            type: 'bar',
            data: {
                labels: this.graphData[0].values.map(this._markIfCorrect, this),
                datasets: this.graphData.map(function (group, index) {
                    var data = group.values.map(function (value) {
                        return value.count;
                    });
                    return {
                        label: group.key,
                        data: data,
                        backgroundColor: D3_COLORS[index % 20],
                    };
                })
            },
            options: {
                scales: {
                    xAxes: [{
                        ticks: {
                            callback: this._customTick(25),
                        },
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            precision: 0,
                        },
                    }],
                },
                tooltips: {
                    callbacks: {
                        title: function (tooltipItem, data) {
                            return data.labels[tooltipItem[0].index];
                        }
                    }
                },
            },
        };
    },

    /**
     * Returns a standard bar chart configuration.
     *
     * @private
     */
    _getBarChartConfig: function () {
        return {
            type: 'bar',
            data: {
                labels: this.graphData[0].values.map(this._markIfCorrect, this),
                datasets: this.graphData.map(function (group) {
                    var data = group.values.map(function (value) {
                        return value.count;
                    });
                    return {
                        label: group.key,
                        data: data,
                        backgroundColor: data.map(function (val, index) {
                            return D3_COLORS[index % 20];
                        }),
                    };
                })
            },
            options: {
                legend: {
                    display: false,
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            callback: this._customTick(35),
                        },
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            precision: 0,
                        },
                    }],
                },
                tooltips: {
                    enabled: false,
                }
            },
        };
    },

    /**
     * Returns a standard pie chart configuration.
     *
     * @private
     */
    _getPieChartConfig: function () {
        var counts = this.graphData.map(function (point) {
            return point.count;
        });

        return {
            type: 'pie',
            data: {
                labels: this.graphData.map(this._markIfCorrect, this),
                datasets: [{
                    label: '',
                    data: counts,
                    backgroundColor: counts.map(function (val, index) {
                        return D3_COLORS[index % 20];
                    }),
                }]
            }
        };
    },

    _getDoughnutChartConfig: function () {
        var totalsGraphData = this.graphData.totals;
        var counts = totalsGraphData.map(function (point) {
            return point.count;
        });

        return {
            type: 'doughnut',
            data: {
                labels: totalsGraphData.map(this._markIfCorrect, this),
                datasets: [{
                    label: '',
                    data: counts,
                    backgroundColor: counts.map(function (val, index) {
                        return D3_COLORS[index % 20];
                    }),
                    borderColor: 'rgba(0, 0, 0, 0.1)'
                }]
            },
            options: {
                title: {
                    display: true,
                    text: _t("Overall Performance"),
                },
            }
        };
    },

    /**
     * Displays the survey results grouped by section.
     * For each section, user can see the percentage of answers
     * - Correct
     * - Partially correct (multiple choices and not all correct answers ticked)
     * - Incorrect
     * - Unanswered
     *
     * e.g:
     *
     * Mathematics:
     * - Correct 75%
     * - Incorrect 25%
     * - Partially correct 0%
     * - Unanswered 0%
     *
     * Geography:
     * - Correct 0%
     * - Incorrect 0%
     * - Partially correct 50%
     * - Unanswered 50%
     *
     *
     * @private
     */
    _getSectionResultsChartConfig: function () {
        var sectionGraphData = this.graphData.by_section;

        var resultKeys = {
            'correct': _t('Correct'),
            'partial': _t('Partially'),
            'incorrect': _t('Incorrect'),
            'skipped': _t('Unanswered'),
        };
        var resultColorIndex = 0;
        var datasets = [];
        for (var resultKey in resultKeys) {
            var data = [];
            for (var section in sectionGraphData) {
                data.push((sectionGraphData[section][resultKey]) / sectionGraphData[section]['question_count'] * 100);
            }
            datasets.push({
                label: resultKeys[resultKey],
                data: data,
                backgroundColor: D3_COLORS[resultColorIndex % 20],
            });
            resultColorIndex++;
        }

        return {
            type: 'bar',
            data: {
                labels: Object.keys(sectionGraphData),
                datasets: datasets
            },
            options: {
                title: {
                    display: true,
                    text: _t("Performance by Section"),
                },
                legend: {
                    display: true,
                },
                scales: {
                    xAxes: [{
                        ticks: {
                            callback: this._customTick(20),
                        },
                    }],
                    yAxes: [{
                        gridLines: {
                            display: false,
                        },
                        ticks: {
                            beginAtZero: true,
                            precision: 0,
                            callback: function (label) {
                                return label + '%';
                            },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            maxTicksLimit: 5,
                            stepSize: 25,
                        },
                    }],
                },
                tooltips: {
                    callbacks: {
                        label: function (tooltipItem, data) {
                            var datasetLabel = data.datasets[tooltipItem.datasetIndex].label || '';
                            var roundedValue = Math.round(tooltipItem.yLabel * 100) / 100;
                            return `${datasetLabel}: ${roundedValue}%`;
                        }
                    }
                }
            },
        };
    },

    /**
     * Custom Tick function to replace overflowing text with '...'
     *
     * @private
     * @param {Integer} tickLimit
     */
    _customTick: function (tickLimit) {
        return function (label) {
            if (label.length <= tickLimit) {
                return label;
            } else {
                return label.slice(0, tickLimit) + '...';
            }
        };
    },

    /**
     * Loads the chart using the provided Chart library.
     *
     * @private
     */
    _loadChart: function () {
        this.$el.css({position: 'relative'});
        var $canvas = this.$('canvas');
        var ctx = $canvas.get(0).getContext('2d');
        return new Chart(ctx, this.chartConfig);
    },

    /**
     * Adds a unicode 'check' mark if the answer's text is among the question's right answers.
     * @private
     * @param  {Object} value
     * @param  {String} value.text The original text of the answer
     */
    _markIfCorrect: function (value) {
        return `${value.text}${this.rightAnswers.indexOf(value.text) >= 0 ? " \u2713": ''}`;
    },

});

publicWidget.registry.SurveyResultWidget = publicWidget.Widget.extend({
    selector: '.o_survey_result',
    events: {
        'click .o_survey_results_topbar_clear_filters': '_onClearFiltersClick',
        'click i.filter-add-answer': '_onFilterAddAnswerClick',
        'click i.filter-remove-answer': '_onFilterRemoveAnswerClick',
        'click a.filter-finished-or-not': '_onFilterFinishedOrNotClick',
        'click a.filter-finished': '_onFilterFinishedClick',
        'click a.filter-failed': '_onFilterFailedClick',
        'click a.filter-passed': '_onFilterPassedClick',
        'click a.filter-passed-and-failed': '_onFilterPassedAndFailedClick',
    },

    //--------------------------------------------------------------------------
    // Widget
    //--------------------------------------------------------------------------

    /**
    * @override
    */
    willStart: function () {
        var url = '/web/webclient/locale/' + (document.documentElement.getAttribute('lang') || 'en_US').replace('-', '_');
        var localeReady = loadJS(url);
        return Promise.all([this._super.apply(this, arguments), localeReady]);
    },

    /**
    * @override
    */
    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var allPromises = [];

            self.$('.pagination').each(function (){
                var questionId = $(this).data("question_id");
                allPromises.push(new publicWidget.registry.SurveyResultPagination(self, {
                    'questionsEl': self.$('#survey_table_question_'+ questionId)
                }).attachTo($(this)));
            });

            self.$('.survey_graph').each(function () {
                allPromises.push(new publicWidget.registry.SurveyResultChart(self)
                    .attachTo($(this)));
            });

            if (allPromises.length !== 0) {
                return Promise.all(allPromises);
            } else {
                return Promise.resolve();
            }
        });
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

     /**
     * Add an answer filter by updating the URL and redirecting.
     * @private
     * @param {Event} ev
     */
    _onFilterAddAnswerClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.set('filters', this._prepareAnswersFilters(params.get('filters'), 'add', ev));
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * Remove an answer filter by updating the URL and redirecting.
     * @private
     * @param {Event} ev
     */
    _onFilterRemoveAnswerClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        let filters = this._prepareAnswersFilters(params.get('filters'), 'remove', ev);
        if (filters) {
            params.set('filters', filters);
        } else {
            params.delete('filters')
        }
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onClearFiltersClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.delete('filters');
        params.delete('finished');
        params.delete('failed');
        params.delete('passed');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onFilterFinishedOrNotClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.delete('finished');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onFilterFinishedClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.set('finished', 'true');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onFilterFailedClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.set('failed', 'true');
        params.delete('passed');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onFilterPassedClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.set('passed', 'true');
        params.delete('failed');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onFilterPassedAndFailedClick: function (ev) {
        let params = new URLSearchParams(window.location.search);
        params.delete('failed');
        params.delete('passed');
        window.location.href = window.location.pathname + '?' + params.toString();
    },

    /**
     * Returns the modified pathname string for filters after adding or removing an
     * answer filter (from click event). Filters are formatted as `"rowX,ansX", where
     * the row is used for matrix-type questions and set to 0 otherwise.
     * @private
     * @param {String} filters Existing answer filters, formatted as `rowX,ansX|rowY,ansY...`.
     * @param {"add" | "remove"} operation Whether to add or remove the filter.
     * @param {Event} ev Event defining the filter.
     * @returns {String} Updated filters.
     */
    _prepareAnswersFilters(filters, operation, ev) {
        const cell = $(ev.target);
        const eventFilter = `${cell.data('rowId') || 0},${cell.data('answerId')}`;

        if (operation === 'add') {
            filters = filters ? filters + `|${eventFilter}` : eventFilter;
        } else if (operation === 'remove') {
            filters = filters
                .split("|")
                .filter(filterItem => filterItem !== eventFilter)
                .join("|");
        } else {
            throw new Error('`operation` parameter for `_prepareAnswersFilters` must be either "add" or "remove".')
        }
        return filters;
    }
});

return {
    resultWidget: publicWidget.registry.SurveyResultWidget,
    chartWidget: publicWidget.registry.SurveyResultChart,
    paginationWidget: publicWidget.registry.SurveyResultPagination
};

});
