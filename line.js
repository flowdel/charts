import { line, curveMonotoneX } from 'd3-shape';

const getStrokeDasharray = (dashStyle) => {
  const dashStyles = {
    Solid: null,
    Dash: '5',
    ShortDash: '2 4',
    LongDash: '9 3',
    Dot: '0.3 6',
    DashDot: '8 4 1 4',
  };

  return dashStyles[dashStyle];
};

export default class Line {
  constructor({
    yValue = 'y',
    xValue = 'x',
    xScale,
    yScale,
    data = [],
    color,
    dashStyle,
    applyGradient = false,
    gradientUrl = null,
    element,
  }) {
    this.xValue = xValue;
    this.yValue = yValue;
    this.xScale = xScale;
    this.yScale = yScale;
    this.chartLine = null;

    this.element = element;

    this.data = data;
    this.color = color;
    this.dashStyle = dashStyle;
    this.applyGradient = applyGradient;
    this.gradientUrl = gradientUrl;


    this.createLine();
  }

  createLine() {
    this.chartLine = line()
      .x(d => this.xScale(d[this.xValue]))
      .y(d => this.yScale(d[this.yValue]))
      .curve(curveMonotoneX);


    const chart = this.element.append('path')
      .datum(this.data)
      .attr('fill', 'none')
      .attr('stroke', this.applyGradient ? this.gradientUrl : this.color)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', getStrokeDasharray(this.dashStyle))
      .attr('stroke-width', 1.5)
      .style('pointer-events', 'none')
      .attr('d', this.chartLine);

    return chart;
  }
}
