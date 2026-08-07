export class DeleteNodeCommand {
  constructor(canvasStore, nodeId) {
    this.canvasStore = canvasStore;
    this.nodeId = nodeId;
    this.deletedNode = null;
    this.deletedEdges = [];
  }

  execute() {
    const { nodes, edges } = this.canvasStore;
    this.deletedNode = nodes.find(n => n.id === this.nodeId);
    this.deletedEdges = edges.filter(e => e.source === this.nodeId || e.target === this.nodeId);
    this.canvasStore.deleteNode(this.nodeId);
  }

  undo() {
    if (this.deletedNode) {
      this.canvasStore.addNode(this.deletedNode);
      if (this.deletedEdges.length > 0) {
        this.canvasStore.setEdges((eds) => [...eds, ...this.deletedEdges]);
      }
    }
  }
}

export default DeleteNodeCommand;
