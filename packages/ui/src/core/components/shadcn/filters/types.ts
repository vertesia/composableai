export interface FilterOption {
  label?: React.ReactNode;
  value?: string;
}

export interface FilterGroup {
  name: string;
  placeholder?: string;
  type?: "select" | "date" | "text";
  options?: FilterOption[];
  allowCreate?: boolean;
  filterBy?: (value: string, searchText: string) => boolean;
}

export interface Filter {
  name: string;
  placeholder?: string;
  value: FilterOption[];
  type?: "select" | "date" | "text";
}

export enum FilterOperator {
  IS = "is",
  IS_NOT = "is_not",
  CONTAINS = "contains",
  BEFORE = "before",
  AFTER = "after",
  IS_ANY_OF = "is_any_of"
}