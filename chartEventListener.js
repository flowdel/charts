export default class ChartEventListener {
    events = {};

    on(names, handler) {
      names.split(' ').forEach((name) => {
        if (!this.events[name]) this.events[name] = [];
        this.events[name].push(handler);
      });

      return this;
    }

    trigger(name, param) {
      if (!this.events[name]) this.events[name] = [];
      return this.events[name].reduce((r, e) => (e(param, this.persistent) !== false) && r, true);
    }
}

