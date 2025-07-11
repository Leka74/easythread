export interface ImportInfo {
  type: 'named' | 'default' | 'namespace';
  source: string;
  importedName?: string;
  localName: string;
}

export interface PluginOptions {
  environment?: 'browser' | 'node';
  filePath?: string;
  resolveId?: (id: string, importer?: string) => Promise<string | null> | string | null;
}

export interface TransformResult {
  code: string;
  map?: string | null;
}

export interface WorkerStrategy {
  generateWorkerSetup(
    functionName: string, 
    workerCode: string, 
    externalVars: string,
    imports: ImportInfo[]
  ): string;
  
  createWorkerRuntime(
    functionCode: string,
    functionName: string,
    isVariableDeclaration: boolean,
    imports: ImportInfo[],
    options: PluginOptions
  ): string;
}