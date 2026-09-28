import React from 'react';
import HttpConfig from './HttpConfig';
import CsvConfig from './CsvConfig';
import ConditionConfig from './ConditionConfig';
import TransformConfig from './TransformConfig';
import GeneralConfig from './GeneralConfig';
import EmailConfig from './EmailConfig';
import JsonConfig from './JsonConfig';
import TextConfig from './TextConfig';
import MathConfig from './MathConfig';
import DateConfig from './DateConfig';

export default function SidebarFactory({
  nodeType,
  data,
  onChange,
  onAutoDetectCsv,
  autoDetectingCsv,
  onOpenVariablePicker,
}) {
  switch (nodeType) {
    case 'action-http':
      return (
        <HttpConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-csv':
      return (
        <CsvConfig
          data={data}
          onChange={onChange}
          onAutoDetect={onAutoDetectCsv}
          autoDetecting={autoDetectingCsv}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'logic-condition':
      return (
        <ConditionConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-transform':
      return (
        <TransformConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-email':
      return (
        <EmailConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-json':
      return (
        <JsonConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-text':
      return (
        <TextConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-math':
      return (
        <MathConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-date':
      return (
        <DateConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    default:
      return (
        <GeneralConfig
          nodeType={nodeType}
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
  }
}
