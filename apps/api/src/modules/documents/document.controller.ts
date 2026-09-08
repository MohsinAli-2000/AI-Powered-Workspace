import type { Request, Response, NextFunction } from 'express';
import {
  documentService,
  type DocumentService,
} from './document.service.js';
import type {
  UploadDocumentInput,
  UpdateDocumentInput,
} from './document.schema.js';

export class DocumentController {
  constructor(
    private readonly docService: DocumentService = documentService
  ) {}

  /**
   * Handles uploading a document to a project.
   * Route: POST /api/v1/projects/:id/documents
   */
  public uploadDocumentHandler = async (
    incomingRequest: Request<{ id: string }, unknown, UploadDocumentInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const projectId = incomingRequest.params.id;
      const uploaderUserId = incomingRequest.authenticatedUser!.id;
      const uploadedFile = incomingRequest.file!;

      const createdDocument = await this.docService.uploadDocument(
        projectId,
        uploaderUserId,
        uploadedFile,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { document: createdDocument },
        message: 'Document uploaded successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all documents in a project.
   * Route: GET /api/v1/projects/:id/documents
   */
  public listProjectDocumentsHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const projectId = incomingRequest.params.id;

      const documents = await this.docService.listProjectDocuments(projectId);

      outgoingResponse.status(200).json({
        success: true,
        data: { documents },
        message: 'Documents retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles retrieving a document by ID.
   * Route: GET /api/v1/documents/:id
   */
  public getDocumentHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const documentId = incomingRequest.params.id;

      const document = await this.docService.getDocument(documentId);

      outgoingResponse.status(200).json({
        success: true,
        data: { document },
        message: 'Document retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles downloading a document file.
   * Route: GET /api/v1/documents/:id/download
   * Query param: ?presigned=true generates a direct S3/MinIO presigned download URL.
   */
  public downloadDocumentHandler = async (
    incomingRequest: Request<{ id: string }, unknown, unknown, { presigned?: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const documentId = incomingRequest.params.id;

      if (incomingRequest.query.presigned === 'true') {
        const presignedResult = await this.docService.getPresignedDownloadUrl(documentId);
        outgoingResponse.status(200).json({
          success: true,
          data: presignedResult,
          message: 'Presigned download URL generated successfully.',
        });
        return;
      }

      const { stream, contentType, originalFilename, fileSize } =
        await this.docService.downloadDocument(documentId);

      outgoingResponse.setHeader('Content-Type', contentType);
      outgoingResponse.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(originalFilename)}"`
      );
      if (fileSize) {
        outgoingResponse.setHeader('Content-Length', fileSize.toString());
      }

      stream.pipe(outgoingResponse);
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating document metadata.
   * Route: PATCH /api/v1/documents/:id
   */
  public updateDocumentHandler = async (
    incomingRequest: Request<{ id: string }, unknown, UpdateDocumentInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const documentId = incomingRequest.params.id;

      const updated = await this.docService.updateDocument(
        documentId,
        incomingRequest.body
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { document: updated },
        message: 'Document updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles deleting a document.
   * Route: DELETE /api/v1/documents/:id
   */
  public deleteDocumentHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const documentId = incomingRequest.params.id;

      await this.docService.deleteDocument(documentId);

      outgoingResponse.status(200).json({
        success: true,
        message: 'Document deleted successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const documentController = new DocumentController();
