export type InvestorCategory = 'Retail' | 'sNII' | 'bNII' | 'Institutional';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'retail' | 'hni' | 'institutional';
  investorCategory: InvestorCategory;
  primaryPan?: string;
  panCount?: number;
  dematCount?: number;
  createdAt: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials {
  name: string;
  email: string;
  password: string;
  investorCategory: InvestorCategory;
  primaryPan?: string;
  termsAccepted: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  message?: string;
}

export interface GoogleAuthPayload {
  email: string;
  name: string;
  avatarUrl?: string;
  googleId?: string;
  investorCategory?: InvestorCategory;
  primaryPan?: string;
}

