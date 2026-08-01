class Picker {
  constructor(props) {
    if (typeof props !== 'object') throw new Error('Picker arguments should be an object')
    this.picker = props.picker;
    this.palette = props.palette;
    this.name = props.name;
    this.x = props?.x;
    this.y = props?.y;
    this.size = props?.size;
    this.ref = props?.ref;
    this.hex = props?.hex;
  }

  // NOTE: previously there was both a `get position()` accessor AND a
  // `position(x, y)` method with the same name. In a class body the later
  // definition silently wins, so the getter was dead code and `.position`
  // was always the setter function below. Renamed the setter to avoid the
  // collision and restored the getter so both reading and writing work.
  get position() {
    return [this.x, this.y];
  }

  setPosition(x, y) {
    this.x = (x !== undefined && x !== null) ? x : this.x;
    this.y = (y !== undefined && y !== null) ? y : this.y;
  }
}

export default Picker;