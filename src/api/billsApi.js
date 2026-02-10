import api from "./apiClient";

export async function listBills(params = {}) {
    const { data } = await api.get("/bills/", { params });
    return data;
}

export async function createBill(payload) {
    const { data } = await api.post("/bills/", payload);
    return data;
}

export async function updateBill(id, patch) {
    const { data } = await api.patch(`/bills/${id}/`, patch);
    return data;
}

export async function deleteBill(id) {
    await api.delete(`/bills/${id}/`);
    return id;
}

export async function generateBillTransactions(billId, body = {}) {
    const { data } = await api.post(`/bills/${billId}/generate/`, body);
    return data;
}
