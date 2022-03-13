import dayjs from 'dayjs';
import CloseIcon from './close-icon';
import EventListener from './chartEventListener';

export default class Tooltip {
  constructor({
    element,
    width,
    height,
    maxXCoord,
    hasIcon = true,
    isClosing = false,
    hasDescription = false,
    hasLink = false,
  }) {
    this.element = element;

    this.container = null;
    this.innerContainer = null;
    this.contentContainer = null;
    this.dateContainer = null;

    this.hasDescription = hasDescription;
    this.hasLink = hasLink;
    this.hasIcon = hasIcon;
    this.isClosing = isClosing;

    this.width = width;
    this.height = height;
    this.maxXCoord = maxXCoord;

    this.eventListener = new EventListener();

    this.createTooltip();
  }

  createTooltip() {
    this.container = this.element
      .append('foreignObject')
      .attr('width', this.width)
      .attr('min-height', 72)
      .attr('height', 0);
    this.innerContainer = this.container
      .append('xhtml:div')
      .classed('tooltip', true);
    this.contentContainer = this.innerContainer.append('div');
    this.dateContainer = this.innerContainer.append('div')
      .classed('tooltip__date', true);
  }

  update({
    data, xCoord, yCoord,
  }) {
    this.contentContainer.html('');

    const x = Math.min(this.maxXCoord - this.width + (this.width / 4), xCoord + 20);
    const y = Math.max(0, yCoord - 100);

    data.forEach((el) => {
      const row = this.contentContainer.append('div')
        .classed('tooltip__row', true);

      const title = row.append('div')
        .classed('tooltip__title', true);

      if (this.hasIcon) {
        title.append('div')
          .classed('tooltip__color', true)
          .style('background', el.color);
      }

      title.append('div')
        .classed('tooltip__name', true)
        .text(`${el.name}: ${el.y}`);

      if (this.isClosing) {
        row.append('g')
          .classed('tooltip__close', true)
          .html(CloseIcon)
          .on('click', () => this.hide());
      }

      if (this.hasDescription && el.description) {
        this.contentContainer.append('div')
          .classed('tooltip__description', true)
          .text(`${el.description}`);
      }


      if (this.hasLink && el.linkText) {
        this.contentContainer.append('div')
          .classed('tooltip__link', true)
          .append('a')
          .text(`${el.linkText}`)
          .on('click', () => {
            this.eventListener.trigger('route', el.additionalData);
          });
      }
    });
    this.dateContainer
      .text(`${dayjs(data[0].x).format('HH:mm:ss, DD.MM')}`);


    this.container
      .style('opacity', 1)
      .attr('transform', `translate(${x},${y})`);

    const { height } = this.innerContainer.node().getBoundingClientRect();
    this.container.attr('height', height);
  }

  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.contentContainer = null;
      this.dateContainer = null;
    }

    this.eventListener.trigger('hide');
  }
}
