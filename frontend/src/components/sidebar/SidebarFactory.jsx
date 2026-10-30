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
import PostgresConfig from './PostgresConfig';
import MongoConfig from './MongoConfig';
import GoogleSheetsConfig from './GoogleSheetsConfig';
import SlackConfig from './SlackConfig';
import DiscordConfig from './DiscordConfig';
import FileConfig from './FileConfig';
import StorageConfig from './StorageConfig';
import LoopConfig from './LoopConfig';

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
    case 'action-postgres':
      return (
        <PostgresConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-mongodb':
      return (
        <MongoConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-google-sheets':
      return (
        <GoogleSheetsConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-slack':
      return (
        <SlackConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-discord':
      return (
        <DiscordConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-file':
      return (
        <FileConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-storage':
      return (
        <StorageConfig
          data={data}
          onChange={onChange}
          onOpenVariablePicker={onOpenVariablePicker}
        />
      );
    case 'action-loop':
      return (
        <LoopConfig
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
