import { Alert, CircularProgress } from "@mui/material";

const SpinnerPage = ({ status }) => {
    if (status === 'loading') {
        return (
            <Alert
                severity="info" // Use um valor padrão aqui
                sx={{
                    color: "#0C5FC8",           // Cor do texto
                    backgroundColor: "#e8f1ff", // Opcional: cor de fundo leve
                    "& .MuiAlert-icon": {       // Garante que o ícone herde a cor
                        color: "#0C5FC8"
                    }
                }}
                icon={<CircularProgress size={16} color="inherit" />} // "inherit" faz o spinner seguir a cor do texto
            >
                Carregando...
            </Alert>
        )
    }
    return null; // Sempre retorne algo caso o status não seja loading
}

export default SpinnerPage;