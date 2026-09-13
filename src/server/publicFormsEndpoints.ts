import { Request, Response } from 'express';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PublicForm, PublicFormInfo, AuthorizedFormSession } from '../types';
import { hashPin, unsealShareToken } from '../lib/cryptoUtils';

export async function handleGetPublicFormInfo(req: Request, res: Response): Promise<void> {
  try {
    const publicId = req.params.publicId?.trim();
    if (!publicId) {
      res.status(400).json({ success: false, error: 'Public form identifier is required' });
      return;
    }

    const docRef = doc(db, 'publicForms', publicId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      res.status(404).json({ success: false, error: 'Form not found' });
      return;
    }

    const data = snap.data() as PublicForm;
    const safeInfo: PublicFormInfo = {
      id: data.id,
      title: data.title || 'Client Requirements Questionnaire',
      description: data.description || '',
      instructions: data.instructions || '',
      contactInfo: data.contactInfo || '',
      projectName: data.projectName || '',
      clientName: data.clientName || '',
      hasPin: data.hasPin !== false,
      status: data.status || 'active',
    };

    res.json({ success: true, form: safeInfo });
  } catch (err: any) {
    console.error('Error fetching public form info:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve form information' });
  }
}

export async function handleVerifyPublicFormPin(req: Request, res: Response): Promise<void> {
  try {
    const { publicFormId, pin } = req.body || {};

    if (!publicFormId) {
      res.status(400).json({ success: false, error: 'publicFormId is required' });
      return;
    }

    const docRef = doc(db, 'publicForms', publicFormId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      res.status(404).json({ success: false, error: 'This form link is invalid or no longer exists.' });
      return;
    }

    const form = snap.data() as PublicForm;

    if (form.status === 'disabled') {
      res.status(403).json({
        success: false,
        error: 'This questionnaire form is temporarily disabled by the project administrator.',
      });
      return;
    }

    if (form.status === 'closed') {
      res.status(403).json({
        success: false,
        error: 'This questionnaire is closed for new submissions.',
      });
      return;
    }

    if (form.status === 'revoked') {
      res.status(403).json({
        success: false,
        error: 'Access to this questionnaire form has been revoked.',
      });
      return;
    }

    if (form.hasPin) {
      if (!pin) {
        res.status(400).json({ success: false, error: 'Access PIN is required' });
        return;
      }

      const inputHash = await hashPin(pin, form.pinSalt);
      if (inputHash !== form.pinHash) {
        res.status(401).json({
          success: false,
          error: 'Incorrect access PIN. Please check the code provided by your administrator.',
        });
        return;
      }
    }

    let tokenToReturn = form.shareToken;
    if (form.hasPin && form.encryptedShareToken && form.iv && form.authTag) {
      const decrypted = await unsealShareToken(
        form.encryptedShareToken,
        form.iv,
        form.authTag,
        pin,
        form.pinSalt
      );
      if (decrypted) {
        tokenToReturn = decrypted;
      }
    }

    const session: AuthorizedFormSession = {
      publicFormId: form.id,
      projectId: form.projectId,
      shareToken: tokenToReturn,
      questionnaireId: form.questionnaireId,
      questionnaireVersion: form.questionnaireVersion,
      clientName: form.clientName || '',
      projectName: form.projectName || '',
      formTitle: form.title,
      instructions: form.instructions,
      verifiedAt: new Date().toISOString(),
    };

    res.json({ success: true, session });
  } catch (err: any) {
    console.error('Error verifying PIN:', err);
    res.status(500).json({ success: false, error: 'Internal server error during verification' });
  }
}
