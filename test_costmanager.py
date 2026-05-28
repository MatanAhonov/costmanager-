"""
Unit tests for Cost Manager RESTful Web Services.
Uses pytest framework and the requests library.

Run with:
    pip install pytest requests
    pytest test_costmanager.py -v
"""
import requests
import pytest

# ─── Service URLs - update these after deployment ───────────────────────
URL_A = "http://localhost:3001"   # logs-service
URL_B = "http://localhost:3002"   # users-service
URL_C = "http://localhost:3003"   # costs-service
URL_D = "http://localhost:3004"   # about-service
# ────────────────────────────────────────────────────────────────────────

# The imaginary test user that must exist in the DB before tests run
TEST_USER_ID = 123123


class TestAbout:
    """Tests for GET /api/about (process D)"""

    def test_about_status_200(self):
        """About endpoint should return HTTP 200"""
        response = requests.get(URL_D + "/api/about")
        assert response.status_code == 200

    def test_about_returns_list(self):
        """About endpoint should return a list"""
        response = requests.get(URL_D + "/api/about")
        data = response.json()
        assert isinstance(data, list)

    def test_about_has_three_members(self):
        """About endpoint should return exactly 3 team members"""
        response = requests.get(URL_D + "/api/about")
        data = response.json()
        assert len(data) == 3

    def test_about_members_have_correct_fields(self):
        """Each member should have first_name and last_name only"""
        response = requests.get(URL_D + "/api/about")
        members = response.json()
        for member in members:
            assert "first_name" in member
            assert "last_name" in member


class TestUsers:
    """Tests for users-related endpoints (process B)"""

    def test_get_all_users_status_200(self):
        """GET /api/users should return HTTP 200"""
        response = requests.get(URL_B + "/api/users")
        assert response.status_code == 200

    def test_get_all_users_returns_list(self):
        """GET /api/users should return a list"""
        response = requests.get(URL_B + "/api/users")
        data = response.json()
        assert isinstance(data, list)

    def test_get_existing_user(self):
        """GET /api/users/123123 should return the imaginary test user"""
        response = requests.get(URL_B + "/api/users/" + str(TEST_USER_ID))
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TEST_USER_ID
        assert "first_name" in data
        assert "last_name" in data
        assert "total" in data

    def test_get_nonexistent_user_returns_404(self):
        """Requesting a user that does not exist should return 404"""
        response = requests.get(URL_B + "/api/users/999999999")
        assert response.status_code == 404

    def test_add_user_success(self):
        """POST /api/add with valid data should return 201 and the new user"""
        new_user = {
            "id": 777777,
            "first_name": "Test",
            "last_name": "User",
            "birthday": "1990-01-01"
        }
        # Clean up first in case the user already exists
        response = requests.post(URL_B + "/api/add", json=new_user)
        assert response.status_code in [201, 400]

    def test_add_user_missing_fields_returns_400(self):
        """POST /api/add without required fields should return 400"""
        response = requests.post(URL_B + "/api/add", json={"id": 888888})
        assert response.status_code == 400

    def test_add_duplicate_user_returns_400(self):
        """Adding the same user twice should return 400 on the second attempt"""
        user = {
            "id": TEST_USER_ID,
            "first_name": "mosh",
            "last_name": "israeli",
            "birthday": "1990-01-01"
        }
        response = requests.post(URL_B + "/api/add", json=user)
        assert response.status_code == 400
        data = response.json()
        assert "id" in data
        assert "message" in data

    def test_error_response_has_id_and_message(self):
        """Error responses should always include id and message fields"""
        response = requests.get(URL_B + "/api/users/999999999")
        data = response.json()
        assert "id" in data
        assert "message" in data


class TestCosts:
    """Tests for costs-related endpoints (process C)"""

    def test_add_cost_success(self):
        """POST /api/add with valid data should return 201"""
        cost = {
            "userid": TEST_USER_ID,
            "description": "test item",
            "category": "food",
            "sum": 10
        }
        response = requests.post(URL_C + "/api/add", json=cost)
        assert response.status_code == 201

    def test_add_cost_returns_correct_fields(self):
        """Added cost should include all required fields in the response"""
        cost = {
            "userid": TEST_USER_ID,
            "description": "milk",
            "category": "food",
            "sum": 5.5
        }
        response = requests.post(URL_C + "/api/add", json=cost)
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "milk"
        assert data["category"] == "food"
        assert data["userid"] == TEST_USER_ID

    def test_add_cost_invalid_category_returns_400(self):
        """POST /api/add with an invalid category should return 400"""
        cost = {
            "userid": TEST_USER_ID,
            "description": "test",
            "category": "invalid_category",
            "sum": 10
        }
        response = requests.post(URL_C + "/api/add", json=cost)
        assert response.status_code == 400

    def test_add_cost_missing_fields_returns_400(self):
        """POST /api/add without required fields should return 400"""
        response = requests.post(URL_C + "/api/add", json={"userid": TEST_USER_ID})
        assert response.status_code == 400

    def test_add_cost_unknown_user_returns_404(self):
        """POST /api/add for a non-existent user should return 404"""
        cost = {
            "userid": 999999999,
            "description": "ghost cost",
            "category": "food",
            "sum": 10
        }
        response = requests.post(URL_C + "/api/add", json=cost)
        assert response.status_code == 404

    def test_get_report_status_200(self):
        """GET /api/report with valid params should return 200"""
        response = requests.get(URL_C + "/api/report", params={
            "id": TEST_USER_ID, "year": 2026, "month": 5
        })
        assert response.status_code == 200

    def test_get_report_structure(self):
        """Report should include userid, year, month, and costs array"""
        response = requests.get(URL_C + "/api/report", params={
            "id": TEST_USER_ID, "year": 2026, "month": 5
        })
        data = response.json()
        assert "userid" in data
        assert "year" in data
        assert "month" in data
        assert "costs" in data
        assert isinstance(data["costs"], list)

    def test_get_report_all_categories_present(self):
        """Report costs array should always include all five categories"""
        response = requests.get(URL_C + "/api/report", params={
            "id": TEST_USER_ID, "year": 2026, "month": 1
        })
        data = response.json()
        category_names = []
        for item in data["costs"]:
            category_names.extend(item.keys())
        assert "food" in category_names
        assert "health" in category_names
        assert "housing" in category_names
        assert "sports" in category_names
        assert "education" in category_names

    def test_get_report_missing_params_returns_400(self):
        """GET /api/report without required params should return 400"""
        response = requests.get(URL_C + "/api/report", params={"id": TEST_USER_ID})
        assert response.status_code == 400


class TestLogs:
    """Tests for logs endpoint (process A)"""

    def test_get_logs_status_200(self):
        """GET /api/logs should return HTTP 200"""
        response = requests.get(URL_A + "/api/logs")
        assert response.status_code == 200

    def test_get_logs_returns_list(self):
        """GET /api/logs should return a list"""
        response = requests.get(URL_A + "/api/logs")
        data = response.json()
        assert isinstance(data, list)

    def test_logs_have_required_fields(self):
        """Each log entry should have method, path, service, and timestamp"""
        response = requests.get(URL_A + "/api/logs")
        logs = response.json()
        if len(logs) > 0:
            log = logs[0]
            assert "method" in log
            assert "path" in log
            assert "service" in log
