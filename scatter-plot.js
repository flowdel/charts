/* eslint-disable class-methods-use-this */
import { select } from 'd3-selection';
import Tooltip from './tooltip';
import EventListener from './chartEventListener';

export default class Line {
  constructor({
    yValue = 'y',
    xValue = 'x',
    xScale,
    yScale,
    data = [],
    color,
    element,
    maxXCoord,
    clickTarget = 'circle',
  }) {
    this.element = element;
    this.xValue = xValue;
    this.yValue = yValue;
    this.xScale = xScale;
    this.yScale = yScale;

    this.maxXCoord = maxXCoord;

    this.clickTarget = clickTarget;

    this.data = data;
    this.color = color;

    this.tooltipOpened = false;
    this.tooltip = null;

    this.eventListener = new EventListener();

    this.createScatterPlot();
  }

  createScatterPlot() {
    const plot = this.element
      .append('g')
      .classed('scatter-plot', true)
      .selectAll('g')
      .data(this.data.data)
      .join('g')
      .classed('scatter-plot__point', true)
      .attr('transform', d => `translate(${this.xScale(d[this.xValue])}, ${this.yScale(d.y) - 11})`)
      .html(d => d.icon);

    plot.on('click', (e) => {
      this.updateTooltipState(e);
    });

    return plot;
  }

  updateTooltipState(e) {
    if (this.tooltipOpened) {
      this.hideTooltip(e);
    } else {
      this.shopTooltip(e);
    }

    if (this.tooltip) {
      this.setTooltipEventListeners(e);
    }
  }

  setTooltipEventListeners(e) {
    this.tooltip.eventListener.on('hide', () => {
      this.hideTooltip(e);
    });

    this.tooltip.eventListener.on('route', (routeData) => {
      this.eventListener.trigger('route', routeData);
    });
  }

  hideTooltip(e) {
    if (this.tooltip.container) {
      this.tooltip.hide();
    }

    const target = this.getClickTarget(e);

    this.unhighlightPoint(target);
    this.toogleTooltipState(false);
  }

  getClickTarget(e) {
    return e.target.nodeName === this.clickTarget
      ? select(e.srcElement)
      : select(e.target.closest(this.clickTarget));
  }

  shopTooltip(e) {
    const closestPoint = select(e.target.closest('g')).datum();
    const target = this.getClickTarget(e);

    this.highlightPoint(target, closestPoint.color);
    this.toogleTooltipState(true);

    this.tooltip = this.createTooltip();

    this.tooltip.update({
      data: [
        {
          x: closestPoint.x,
          y: +closestPoint.y.toFixed(2),
          name: this.data.name,
          description: closestPoint.description,
          linkText: closestPoint.linkText,
          additionalData: closestPoint.additionalData,
        },
      ],
      xCoord: e.offsetX - 50,
      yCoord: e.offsetY - 100,
    });
  }

  highlightPoint(point, color) {
    point
      .style('stroke', color)
      .style('stroke-width', '8px')
      .style('stroke-opacity', '0.5');
  }

  unhighlightPoint(point) {
    point
      .attr('stroke', '0')
      .style('stroke-width', '0')
      .style('stroke-opacity', '0');
  }

  toogleTooltipState(value) {
    this.tooltipOpened = value;
  }

  createTooltip() {
    const tooltip = new Tooltip({
      element: this.element,
      height: 'auto',
      width: 240,
      maxXCoord: this.maxXCoord,
      hasIcon: false,
      isClosing: true,
      hasDescription: true,
      hasLink: true,
    });

    return tooltip;
  }
}
