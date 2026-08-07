export class DuplicateNodeCommand {
  constructor(canvasStore, nodeId) {
    this.canvasStore = canvasStore;
    this.nodeId = nodeId;
    this.duplicatedNodePayload = null;
  }

  execute() {
    const { nodes } = this.canvasStore;
    const target = nodes.find(n => n.id === this.nodeId);
    if (!target) return;

    this.duplicatedNodePayload = {
      ...target,
      id: `node_${Date.now()}`,
      position: { x: (target.position?.x ?? 100) + 40, y: (target.position?.y ?? 100) + 40 },
    };

    this.canvasStore.addNode(this.duplicatedNodePayload);
  }

  undo() {
    if (this.duplicatedNodePayload?.id) {
      this.canvasStore.deleteNode(this.duplicatedNodePayload.id);
    }
  }
}

export default DuplicateNodeCommand;
