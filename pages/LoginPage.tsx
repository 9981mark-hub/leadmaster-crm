import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Wrench } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle, loginAsDev } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl text-center">
        <div>
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
             </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">LeadMaster</h1>
          <p className="mt-2 text-sm text-gray-500">안전한 고객 관리를 위한 CRM 시스템</p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-left">
            <h3 className="text-sm font-bold text-blue-800 mb-1">📢 로그인 안내</h3>
            <p className="text-xs text-blue-700">
                허용된 Google 계정으로만 로그인이 가능합니다.<br/>
                접근 권한이 필요한 경우 관리자에게 문의해주세요.
            </p>
        </div>

        <div className="flex justify-center py-4">
            <GoogleLogin
                onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                        loginWithGoogle(credentialResponse.credential);
                    }
                }}
                onError={() => {
                    console.log('Login Failed');
                    alert('구글 로그인에 실패했습니다.');
                }}
                shape="pill"
                size="large"
                theme="outline"
                text="continue_with"
                locale="ko"
            />
        </div>

        {/* 개발자용 임시 로그인 버튼 */}
        <div className="pt-6 border-t border-gray-100">
            <button 
                onClick={loginAsDev}
                className="flex items-center justify-center w-full px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors"
            >
                <Wrench size={14} className="mr-2" />
                (개발용) 설정 없이 임시 로그인
            </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
            &copy; {new Date().getFullYear()} LeadMaster CRM. All rights reserved.
        </p>
      </div>
    </div>
  );
}