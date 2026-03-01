export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/**
 * A specialized error class for Firestore permission issues.
 * includes context about the denied operation and path.
 */
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    super(
      `Firestore Permission Denied: The following request was denied by Security Rules:\n` +
      `Operation: ${context.operation}\n` +
      `Path: ${context.path}\n` +
      (context.requestResourceData 
        ? `Data: ${JSON.stringify(context.requestResourceData, null, 2)}` 
        : '')
    );
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
