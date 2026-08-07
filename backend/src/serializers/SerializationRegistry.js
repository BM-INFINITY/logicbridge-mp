const NodeSerializer = require('./NodeSerializer');
const EdgeSerializer = require('./EdgeSerializer');
const StatisticsSerializer = require('./StatisticsSerializer');

/**
 * SerializationRegistry coordinates component serializers for nodes, edges, and statistics
 */
class SerializationRegistry {
  constructor() {
    this.nodeSerializer = NodeSerializer;
    this.edgeSerializer = EdgeSerializer;
    this.statisticsSerializer = StatisticsSerializer;
  }

  serializeNodes(nodes) {
    return this.nodeSerializer.serialize(nodes);
  }

  deserializeNodes(nodes) {
    return this.nodeSerializer.deserialize(nodes);
  }

  validateNodes(nodes) {
    return this.nodeSerializer.validate(nodes);
  }

  serializeEdges(edges) {
    return this.edgeSerializer.serialize(edges);
  }

  deserializeEdges(edges) {
    return this.edgeSerializer.deserialize(edges);
  }

  validateEdges(edges, nodes) {
    return this.edgeSerializer.validate(edges, nodes);
  }

  serializeStatistics(nodes, edges) {
    return this.statisticsSerializer.serialize(nodes, edges);
  }

  deserializeStatistics(stats) {
    return this.statisticsSerializer.deserialize(stats);
  }
}

const serializationRegistry = new SerializationRegistry();

module.exports = {
  serializationRegistry,
  SerializationRegistry,
  NodeSerializer,
  EdgeSerializer,
  StatisticsSerializer,
};
