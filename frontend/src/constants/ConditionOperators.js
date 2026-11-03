export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals (=)' },
  { value: 'not_equals', label: 'Not Equals (!=)' },
  { value: 'greater_than', label: 'Greater Than (>)' },
  { value: 'less_than', label: 'Less Than (<)' },
  { value: 'greater_or_equal', label: 'Greater or Equal (>=)' },
  { value: 'less_or_equal', label: 'Less or Equal (<=)' },
  { value: 'contains', label: 'Contains (Substring / Item)' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
  { value: 'exists', label: 'Exists (Not Null)' },
  { value: 'does_not_exist', label: 'Does Not Exist (Null)' },
  { value: 'is_true', label: 'Is True / Truthy' },
  { value: 'is_false', label: 'Is False / Falsy' },
  { value: 'matches_regex', label: 'Matches Regex' },
  { value: 'does_not_match_regex', label: 'Does Not Match Regex' },
];

export const UNARY_OPERATORS = new Set([
  'is_empty',
  'is_not_empty',
  'exists',
  'does_not_exist',
  'is_true',
  'is_false',
]);

