export interface FilterOption {
  label?: React.ReactNode;
  value?: string;
}

export interface FilterGroupOption {
  label?: React.ReactNode;
  value?: string;
  labelRenderer?: (value: string) => React.ReactNode | Promise<React.ReactNode>;
}

export interface FilterGroup {
  name: string;
  placeholder?: string;
  type?: "select" | "date" | "text" | "stringList" | "id";
  multiple?: boolean;
  options?: FilterGroupOption[];
  allowCreate?: boolean;
  filterBy?: (value: string, searchText: string) => boolean;
  labelRenderer?: (value: string) => React.ReactNode | Promise<React.ReactNode>;
}

export interface Filter {
  name: string;
  placeholder?: string;
  value: FilterOption[] | string[];
  type?: "select" | "date" | "text" | "stringList" | "id";
  multiple?: boolean;
}

export enum FilterOperator {
  IS = "is",
  IS_NOT = "is_not",
  CONTAINS = "contains",
  BEFORE = "before",
  AFTER = "after",
  IS_ANY_OF = "is_any_of"
}