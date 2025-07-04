import { createContext, useContext } from 'react';
import { defaultTheme } from '../constants';
import { IXmlViewerContext } from '../types';

const defaultState: IXmlViewerContext = {
  theme: defaultTheme,
  collapsible: false,
  indentSize: 2,
};

export const XMLViewerContext = createContext<IXmlViewerContext>(defaultState);
export const useXMLViewerContext = () => useContext(XMLViewerContext);
