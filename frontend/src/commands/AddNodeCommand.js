export class AddNodeCommand {
  constructor(canvasStore, nodePayload) {
    this.canvasStore = canvasStore;
    this.nodePayload = nodePayload;
  }

  execute() {
    this.canvasStore.addNode(this.nodePayload);
  }

  undo() {
    if (this.nodePayload?.id) {
      this.canvasStore.deleteNode(this.nodePayload.id);
    }
  }
}

export default AddNodeCommand;
