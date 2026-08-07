const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { transformTemplate } = require('../utils');

class TransformNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_TRANSFORM,
      name: 'Transform Data',
      category: 'action',
      icon: '🔄',
      description: 'Transforms JSON data structure mapping keys to template expressions',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const prev = context.lastOutput;
    const template = node.data?.template || '';
    return transformTemplate(template, prev);
  }
}

module.exports = TransformNode;
