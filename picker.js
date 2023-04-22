class Picker {
  constructor(props) {
    if (typeof props !== 'object') throw new Error('Picker arguments should be an object')
    this.picker = props.picker;
    this.palette = props.palette;
    this.name = props.name;
    this.x = props?.x;
    this.y = props?.y;
    this.size = props?.size;
    this.ref = props?.ref
    this.hex = props?.hex
  }

  get position() {
    return [this.x, this.y]
  }
  position(x, y) {
    //if (!x || !y) throw new Error('Provide a value for x and y');
    this.x = x || this.x;
    this.y = y || this.y;
  }

}

export default Picker;
