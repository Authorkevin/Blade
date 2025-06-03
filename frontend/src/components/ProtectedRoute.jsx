import {Navigate} from "react-router-dom";
import {jwtDecode} from "jwt-decode";
import api from "../api";
import {REFRESH_TOKEN, ACCESS_TOKEN} from "../constants";
import {useState, useEffect} from "react"
function ProtectedRoute({children}) {
    const [isAuthorized, setIsAuthorized] = useState(null);
    useEffect(() => {
        auth().catch(() => setIsAuthorized(false))
    }, []);
    const refreshToken = async () => {
        const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN);
        try {
            const res = await api.post("/auth/jwt/refresh/", {refresh: refreshTokenValue,});
            if (res.status === 200) {
                localStorage.setItem(ACCESS_TOKEN, res.data.access);
                return true;
            } else {
                console.log("Token refresh failed with status:", res.status);
                alert("Token refresh failed with status:", res.status);
                return false
            }
        } catch (error) {
            console.log(error);
            alert(error);
            return false;
        }
    };
    const auth = async () => {
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
            setIsAuthorized(false);
            return;
        }
        const decoded = jwtDecode(token);
        const tokenExpiration = decoded.exp;
        const now = Date.now() / 1000;
        if (tokenExpiration < now) {
            const refreshedSuccessfully = await refreshToken();
            setIsAuthorized(refreshedSuccessfully);
        } else {
            setIsAuthorized(true);
        }
    };
    if (isAuthorized === null) {
        return <div>Loading...</div>
    };
    return isAuthorized ? children : <Navigate to="/login" />
};

export default ProtectedRoute;
