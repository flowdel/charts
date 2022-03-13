import { interpolate } from 'd3-interpolate';
import { arc } from 'd3-shape';
import { scaleLinear } from 'd3-scale';

const degToRad = deg => deg * Math.PI / 180;

const getColor = (value, range, colors) => {
  // range and color arrays should be the same length!!!
  let i = 0;
  while (i < range.length) {
    if (value < range[i]) {
      return colors[i];
    }

    i += 1;
  }

  return colors[colors.length - 1];
};

export default class Gauge {
  constructor({
    width = 200,
    height = 100,
    innerRadius = 60,
    outerRadius = 80,
    arcMin = -90,
    arcMax = 90,
    cornerRadius = 3,
    element,
    data,
    units,
    margin,
    domainData,
    colorOptions = ['#55BB00', '#FFB800', '#FF4331'],
    hasThresholdArc = false,
    gaugeType = 'solid',
    points,
  }) {
    this.element = element;

    this.data = data;
    this.points = points;
    this.units = units;

    this.hasThresholdArc = hasThresholdArc;

    this.margin = margin;
    this.cornerRadius = cornerRadius;
    this.width = width;
    this.height = height;

    this.gaugeType = gaugeType;
    this.arcMin = arcMin;
    this.arcMax = arcMax;
    this.arc = null;
    this.outerArc = null;

    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;

    this.domainData = domainData;

    this.arcScale = null;
    this.colorOptions = colorOptions;

    this.createGauge();
  }

  createGauge() {
    this.arcScale = scaleLinear()
      .domain(this.domainData)
      .range([this.arcMin, this.arcMax]);

    this.chartContainer = this.element
      .append('g')
      .classed('arc-chart', true);

    this.arcContainer = this.chartContainer
      .append('g')
      .classed('arc', true);

    const createFunc = {
      solid: this.createSolidGauge,
      segment: this.createSegmentGauge,
    };

    const segments = this.points.map((item, i) => ({
      ...item,
      start: i === 0 ? 0 : this.points[i - 1].point / this.data.maxValue,
      end: item.point / this.data.maxValue,
    }));

    if (this.hasThresholdArc) {
      this.createSegmentGauge({
        innerRadius: this.outerRadius + 6,
        outerRadius: this.outerRadius + 8,
        cornerRadius: this.cornerRadius,
        segments,
        gaugeClass: 'arc__threshold',
        opacityFunc: (d) => {
          const ratio = this.data.data[0] / this.data.maxValue;
          if (ratio >= d.start) return 1;
          return 0.2;
        },
        range: 180,
      });
    }

    createFunc[this.gaugeType].call(this, {
      ...this.data,
      segments,
      gaugeClass: 'arc__data',
      opacityFunc: () => 1,
    });
  }

  createSolidGauge({
    outerRadius, innerRadius, cornerRadius, gaugeClass,
  }) {
    this.chartContainer.attr('transform', `translate(${this.width / 2},${this.height})`);

    const chartArc = arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(degToRad(this.arcMin))
      .cornerRadius(cornerRadius);

    const bgArc = this.arcContainer
      .append('path')
      .classed('arc__bg', true);

    const dataArc = this.arcContainer
      .append('path')
      .classed(gaugeClass, true)
      .datum({
        startAngle: degToRad(this.arcMin),
        endAngle: degToRad(this.arcMin),
      })
      .style('stroke-linejoin', 'round')
      .attr('d', chartArc);

    const arcUnitText = this.arcContainer
      .append('text')
      .classed('arc__units', true);

    const arcValueText = this.arcContainer
      .append('text')
      .classed('arc__value', true);

    bgArc
      .datum({
        endAngle: degToRad(this.arcMax),
      })
      .style('stroke-linejoin', 'round')
      .style('fill', 'var(--layer)')
      .attr('d', chartArc);

    const pointValues = this.points.map(el => el.point);
    const dataEndColor = getColor(this.data.data[0], pointValues, this.colorOptions);

    dataArc
      .datum({ endAngle: degToRad(this.arcScale(this.data.data[0])) })
      .style('fill', dataEndColor)
      .transition()
      .duration(400)
      .attrTween('d', (d) => {
        const animationStartState = {
          startAngle: degToRad(this.arcMin),
          endAngle: degToRad(this.arcMin),
        };
        const animationEndState = d;
        const interpolateFunc = interpolate(animationStartState, animationEndState);
        return t => chartArc(interpolateFunc(t));
      });

    const arcBox = bgArc.node().getBBox();

    arcValueText
      .attr('x', (arcBox.width / 2) + arcBox.x)
      .attr('y', -15)
      .style('alignment-baseline', 'central')
      .style('text-anchor', 'middle')
      .style('font-size', '30px')
      .style('fill', 'var(--text-base-color)')
      .text(this.data.data[0]);

    arcUnitText
      .attr('x', (arcBox.width / 2) + arcBox.x)
      .attr('y', -45)
      .style('alignment-baseline', 'central')
      .style('text-anchor', 'middle')
      .style('font-size', '20px')
      .style('fill', 'var(--text-secondary-color)')
      .text(this.data.unit);
  }

  createSegmentGauge({
    outerRadius,
    innerRadius,
    cornerRadius,
    segments,
    gaugeClass,
    opacityFunc,
    range,
  }) {
    this.chartContainer.attr('transform', `translate(${this.width / 2},${this.height / 2})`);
    const arcChart = arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(cornerRadius)
      .startAngle(d => degToRad(this.arcMin + (range * d.start)))
      .endAngle(d => degToRad((this.arcMin + (range * d.end))));

    const dataArc = this.arcContainer
      .append('g')
      .classed(gaugeClass, true);

    dataArc.selectAll('path')
      .data(segments)
      .enter()
      .append('path')
      .attr('fill', d => d.color)
      .style('opacity', opacityFunc)
      .attr('d', arcChart);
  }
}
