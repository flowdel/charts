import { select, pointer } from 'd3-selection';
import { brushX } from 'd3-brush';
import {
  extent, bisector, range,
} from 'd3-array';
import { scaleTime, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { timeFormat } from 'd3-time-format';
import dayjs from 'dayjs';
import EventListener from './chartEventListener';

import Line from './line';
import Gauge from './gauge';
import ScatterPlot from './scatter-plot';
import Tooltip from './tooltip';

const getClosestPoint = (x, xScale, xValue, data) => {
  if (data.length === 1) {
    return data[0];
  }

  const bisect = bisector(d => d[xValue]).left;
  const selectedP = xScale.invert(x);
  const idx = bisect(data, selectedP, 1);

  const leftP = data[idx - 1];
  const rightP = data[idx];

  const d = selectedP - leftP[xValue] > rightP[xValue] - selectedP ? rightP : leftP;
  return d;
};

const getXTickNumber = (chartWidth) => {
  switch (true) {
    case chartWidth >= 800:
      return 7;
    case chartWidth < 800 && chartWidth >= 400:
      return 5;
    case chartWidth < 400:
      return 3;
    default:
      return 5;
  }
};

const getGradientData = (min, max, warningValue, criticalValue) => {
  let values;
  let colors;
  let offsets;

  if (min > warningValue && max < criticalValue) { // case if all data points are between warningValue and criticalValue
    offsets = ['0%', '100%'];
    colors = ['var(--yellow)', 'var(--yellow)'];
  } else if (min < warningValue && max < warningValue) { // case if all data points are less than warningValue
    offsets = ['0%', '100%'];
    colors = ['var(--green)', 'var(--green)'];
  } else if (min > criticalValue) { // case if all data points are bigger than criticalValue
    offsets = ['0%', '100%'];
    colors = ['var(--red)', 'var(--red)'];
  } else { // case if data points are distributed
    values = [min, warningValue, warningValue, criticalValue, criticalValue, max].map(el => el - min);
    offsets = values.map(el => `${100 * el / values[values.length - 1]}%`);
    colors = ['var(--green)', 'var(--green)', 'var(--yellow)', 'var(--yellow)', 'var(--red)', 'var(--red)'];
  }

  return [offsets, colors];
};

const getTickList = (min, max, tickAmount) => {
  const tickStep = (max - min) / (tickAmount);
  let tickList = range(min, max + tickStep / 2, tickStep).map(n => +n);

  if (!tickList.length) {
    tickList = [max];
  }

  return tickList;
};

export default class Chart {
  eventListener = null;

  constructor({
    element,
    data,
    width = 900,
    height = 400,
    xValue = 'x',
    yValue = 'y',
    showCriticalAreas = false,
    textColor = 'var(--text-base-color)',
    enableZoom = true,
    showLegend = true,
    showTooltip = true,
    showScales = true,
    margin = {
      top: 40,
      right: 40,
      bottom: 40,
      left: 50,
    },
  }) {
    this.element = element;

    this.container = null;
    this.chartContainer = null;
    this.pointerEventsContainer = null;
    this.headerContainer = null;
    this.headerInnerContainer = null;

    this.width = width;
    this.height = height;
    this.margin = margin;
    this.defaultColor = 'blue';
    this.textColor = textColor;

    this.data = data;
    this.showCriticalAreas = showCriticalAreas;
    this.enableZoom = enableZoom;
    this.showLegend = showLegend;
    this.showTooltip = showTooltip;
    this.showScales = showScales;

    this.chart = null;
    this.xValue = xValue;
    this.yValue = yValue;
    this.xAxis = null;
    this.yAxis = null;
    this.yAxisWidth = 35 * (this.data.length - 1);
    this.headerHeight = null;

    this.tooltip = null;

    this.group = this.data.length > 1;

    this.eventListener = new EventListener();

    this.drawChartContainer();
    this.drawChart();
  }

  drawChartContainer() {
    this.container = select(this.element)
      .append('svg')
      .classed('chart', true)
      .attr('width', this.width)
      .attr('height', this.height);
  }

  drawChart() {
    if (this.showLegend) {
      this.addLegends();
    }

    this.setHeaderHeight();

    this.chartContainer = this.container
      .append('g')
      .attr('transform', `translate(${this.margin.left + this.yAxisWidth},${this.margin.top + this.headerHeight})`)
      .attr('width', this.width - (this.margin.left + this.margin.right));

    if (this.showScales) {
      this.data = this.data.map(((el) => {
        const xScale = this.createXScale(el.data);
        const yScale = this.createYScale(el.data);
        return {
          ...el,
          xScale,
          yScale,
        };
      }));
      this.addAxes();
    }


    if (this.showTooltip) {
      this.createPointerEventsContainer();
      this.setPointEventListeners();
    }

    this.addChart();
  }

  addChart() {
    const chartFuncs = {
      line: this.createLineChart,
      gauge: this.createGaugeChart,
      scatterplot: this.createScatterPlot,
    };
    this.data = this.data.map((el, idx) => chartFuncs[el.type].call(this, el, idx));
  }

  createLineChart(data, idx) {
    const line = this.createLine(data, idx);
    const { pointIcon, pointIconShadow } = this.createPoints(data);
    return {
      ...data,
      line,
      pointIcon,
      pointIconShadow,
    };
  }

  createGaugeChart(data) {
    const gauge = new Gauge({
      ...data,
      width: this.width,
      height: this.height,
      cornerRadius: 4,
      element: this.chartContainer,
      data,
      units: data.units,
      points: data.points,
      pointValue: data.pointValue,
      domainData: [0, data.maxValue],
      hasThresholdArc: data.subtype === 'solid',
      gaugeType: data.subtype,
      margin: this.margin,
    });

    return {
      ...data,
      gauge,
    };
  }

  createLine(data) {
    const { warningValue, criticalValue } = data;

    const showAreas = this.isShowAreas({ warningValue, criticalValue });

    if (showAreas) {
      this.addGradient(data, warningValue, criticalValue);
    }

    const chartLine = new Line({
      xValue: this.xValue,
      yValue: this.yValue,
      xScale: data.xScale,
      yScale: data.yScale,
      element: this.chartContainer,
      data: data.data,
      color: data.color || this.defaultColor,
      dashStyle: data.dashStyle,
      applyGradient: showAreas,
      gradientUrl: `url(#areas-gradient-${data.id})`,
    });

    return chartLine;
  }

  createScatterPlot({
    data, xScale, yScale, maxXCoord,
  }) {
    const scatterPlot = new ScatterPlot({
      element: this.chartContainer,
      data,
      color: data.color || this.defaultColor,
      xScale,
      yScale,
      pointIcon: data.icon,
      maxXCoord,
      margin: this.margin,
    });

    scatterPlot.eventListener.on('route', (e) => {
      this.eventListener.trigger('route', e);
    });

    return {
      ...data,
      scatterPlot,
    }
  }

  removeChart() {
    this.container.remove();
  }

  zoomChart(event) {
    const { selection } = event;

    if (selection) {
      const x1 = getClosestPoint(selection[0], this.data[0].xScale, this.xValue, this.data[0].data);
      const x2 = getClosestPoint(selection[1], this.data[0].xScale, this.xValue, this.data[0].data);

      const start = dayjs(x1[this.xValue]).format('YYYY-MM-DD HH:mm:ss');
      const end = dayjs(x2[this.xValue]).format('YYYY-MM-DD HH:mm:ss');

      this.eventListener.trigger('zoom', { start, end });
    }
  }

  createXScale(data) {
    if (!data.length) return null;
    const xScale = scaleTime()
      .domain([data[0][this.xValue], data[data.length - 1][this.xValue]])
      .range([0, this.width - (this.margin.left + this.margin.right) - this.yAxisWidth]);

    return xScale;
  }

  createYScale(data) {
    if (!data.length) return null;
    const yExtent = extent(data, d => d[this.yValue]);
    yExtent[0] = yExtent[0] > 0 ? 0 : yExtent[0];

    const yScale = scaleLinear()
      .domain(yExtent)
      .range([this.height - (this.margin.top + this.margin.bottom + this.headerHeight), 0]);

    return yScale;
  }

  addAxes() {
    const xExtent = extent(this.data[0].data, d => d[this.xValue]);
    const xTicksAmount = getXTickNumber(this.width);
    const xTickList = getTickList(xExtent[0], xExtent[1], xTicksAmount);

    const xAxisTemplate = axisBottom(this.data[0].xScale)
      .ticks(xTicksAmount)
      .tickFormat(timeFormat('%H:%M, %d.%m'))
      .tickValues(xTickList);

    this.xAxis = this.chartContainer.append('g')
      .attr('class', 'chart-x-axis')
      .attr('transform', `translate(0,${this.height - (this.margin.top + this.margin.bottom + this.headerHeight)})`)
      .call(xAxisTemplate);

    this.xAxis.select('.domain')
      .remove();

    this.xAxis
      .selectAll('text')
      .style('fill', this.textColor);

    this.xAxis
      .selectAll('line')
      .remove();

    this.data = this.data.map((el, idx) => {
      if (!el.data.length) return el;

      const yTicksAmount = 5;
      const yTickList = getTickList(0, el.maxValue, yTicksAmount);

      const yAxisTemplate = axisLeft(el.yScale)
        .ticks(yTicksAmount)
        .tickFormat((d) => {
          if (d >= 1000 && d <= 999999) {
            return `${(d / 1000).toFixed(1)}k`;
          }
          if (d > 999999 && d <= 999999999) {
            return `${(d / 1000000).toFixed(1)}kk`;
          }
          if (d > 999999999) {
            return `${(d / 1000000000).toFixed(1)}kkk`;
          }
          return d.toFixed(1);
        })
        .tickValues(yTickList)
        .tickSize(-(this.width - (this.margin.left + this.margin.right) - this.yAxisWidth));

      const yAxis = this.chartContainer.append('g')
        .attr('class', `chart-y-axis-${el.id}`)
        .call(yAxisTemplate)
        .attr('transform', `translate(${-35 * idx},0)`);


      yAxis.select('.domain')
        .remove();

      yAxis
        .selectAll('text')
        .attr('x', -10)
        .style('fill', el.color || this.defaultColor);

      yAxis
        .selectAll('line')
        .style('stroke', 'var(--layer)');

      if (idx > 0) {
        yAxis
          .selectAll('line')
          .remove();
      }

      return {
        ...el,
        yAxis,
      };
    });
  }

  setHeaderHeight() {
    const legendListHeight = select('.legend-list').node().getBoundingClientRect().height;
    this.headerContainer.attr('height', `${legendListHeight}px`);
    this.headerHeight = headerHeight;
  }

  isShowAreas(values) {
    return this.showCriticalAreas && values.warningValue !== 0 && values.criticalValue !== 0;
  }

  addGradient(data, warningValue, criticalValue) {
    const [min, max] = extent(data.data, d => d[this.yValue]);
    const [offsets, colors] = getGradientData(min, max, warningValue, criticalValue);

    this.chartContainer.append('linearGradient')
      .attr('id', `areas-gradient-${data.id}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', this.height - (this.margin.top + this.margin.bottom + this.headerHeight))
      .attr('x2', 0)
      .attr('y2', 0)
      .selectAll('stop')
      .data(offsets)
      .join('stop')
      .attr('offset', d => d)
      .attr('stop-color', (d, idx) => colors[idx]);
  }

  createPoints(data) {
    const pointIcon = this.chartContainer
      .append('circle')
      .style('pointer-events', 'none')
      .style('fill', data.color || this.defaultColor)
      .attr('stroke', 'white')
      .attr('r', 7)
      .style('opacity', 0);

    const pointIconShadow = this.chartContainer
      .append('circle')
      .style('pointer-events', 'none')
      .style('fill', 'none')
      .attr('stroke', data.color || this.defaultColor)
      .attr('stroke-width', 5)
      .attr('r', 10)
      .style('opacity', 0);

    return { pointIcon, pointIconShadow };
  }

  createPointerEventsContainer() {
    if (this.enableZoom) {
      const boundZoomFunction = this.zoomChart.bind(this);
      const pointerContainer = brushX()
        .extent([
          [0, 0],
          [this.width - (this.margin.left + this.margin.right + this.yAxisWidth),
            this.height - (this.margin.top + this.margin.bottom + this.headerHeight)],
        ])
        .on('end', boundZoomFunction);

      this.pointerEventsContainer = this.chartContainer
        .append('g')
        .attr('class', 'pointer-container')
        .call(pointerContainer);

      this.pointerEventsContainer
        .select('.selection')
        .style('stroke', 'none');
    } else {
      this.pointerEventsContainer = this.chartContainer
        .append('rect')
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .attr('width', this.width - (this.margin.left + this.margin.right))
        .attr('width', this.width - (this.margin.left + this.margin.right) - this.yAxisWidth)
        .attr('height', this.height - (this.margin.top + this.margin.bottom))
        .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`)
        .attr('transform', `translate(${this.margin.left + this.yAxisWidth}, ${this.margin.top})`);
    }
  }

  setPointEventListeners() {
    this.pointerEventsContainer
      .on('mouseover', () => {
        this.createTooltip();
      })
      .on('mousemove', (e) => {
        this.updateTooltip(e);
      })
      .on('mouseout', () => {
        this.hideTooltip();
      });
  }

  createTooltip() {
    const tooltip = new Tooltip({
      element: this.chartContainer,
      height: 'auto',
      maxXCoord: this.chartContainer.node().getBBox().width - this.yAxisWidth - this.margin.right,
      width: 240,
    });

    this.tooltip = tooltip;
  }

  updateTooltip(e) {
    const dataForTooltip = [];
    this.data.forEach((data) => {
      const closestPoint = getClosestPoint(pointer(e)[0], data.xScale, this.xValue, data.data);

      data.pointIcon
        .style('opacity', 1)
        .attr('cx', data.xScale(closestPoint[this.xValue]))
        .attr('cy', data.yScale(closestPoint[this.yValue]));

      data.pointIconShadow
        .style('opacity', 0.5)
        .attr('cx', data.xScale(closestPoint[this.xValue]))
        .attr('cy', data.yScale(closestPoint[this.yValue]));

      dataForTooltip.push({
        x: closestPoint.x,
        y: closestPoint.y.toFixed(2),
        name: data.name,
        color: data.color || this.defaultColor,
      });
    });

    this.tooltip.update({
      data: dataForTooltip,
      xCoord: pointer(e)[0],
      yCoord: pointer(e)[1],
    });
  }

  hideTooltip() {
    this.data.forEach((data) => {
      data.pointIcon.style('opacity', 0);
      data.pointIconShadow.style('opacity', 0);
    });
    this.tooltip.hide();
  }

  addLegends() {
    this.headerContainer = this.container
      .append('foreignObject')
      .classed('chart-header', true)
      .attr('width', '100%')
      .attr('height', '1px');

    this.headerInnerContainer = this.headerContainer
      .append('xhtml:div')
      .classed('chart-header__inner', true);

    const legendList = this.headerInnerContainer
      .append('div')
      .classed('legend-list', true);

    this.data = this.data.map((el) => {
      const legend = legendList
        .append('div')
        .classed('legend', true);

      legend.append('div')
        .classed('legend__color', true)
        .style('background', el.color || this.defaultColor);

      legend.append('div')
        .classed('legend__name', true)
        .style('color', this.textColor)
        .text(`${el.name}`);

      return {
        ...el,
        legend,
      };
    });
  }
}
