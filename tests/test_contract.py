from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class VNextContract(unittest.TestCase):
    def test_project_and_service_binding(self):
        self.assertEqual(
            "yhct-social-260902-42a4",
            json.loads(read(".firebaserc"))["projects"]["default"],
        )
        config = read("dataconnect/dataconnect.yaml")
        for token in (
            "serviceId: yhct-social-vnext",
            "location: asia-southeast1",
            "database: yhct_vnext",
            "instanceId: yhct-postgres",
            "schemaValidation: COMPATIBLE",
        ):
            self.assertIn(token, config)
        self.assertNotIn("yhct_v27", config)

    def test_core_schema_scope(self):
        schema = read("dataconnect/schema/core.gql")
        tables = re.findall(r"(?m)^type\s+(\w+)\s+@table", schema)
        self.assertEqual(["User", "Post", "Comment", "Reaction", "Media"], tables)
        self.assertIn('uid: String! @default(expr: "auth.uid")', schema)
        self.assertIn("mssv: String! @unique", schema)
        self.assertIn('type Reaction @table(key: ["post", "user"])', schema)

    def test_operations_are_authenticated_and_identity_bound(self):
        ops = read("dataconnect/social/queries.gql") + read("dataconnect/social/mutations.gql")
        self.assertIn("@auth(level: USER)", ops)
        self.assertIn('uid_expr: "auth.uid"', ops)
        self.assertIn('authorUid_expr: "auth.uid"', ops)
        self.assertIn('userUid_expr: "auth.uid"', ops)
        self.assertNotRegex(ops, r"\$\w*(?:Uid|UserId|userId)\b")

    def test_ci_is_oidc_only_and_scoped(self):
        workflow = read(".github/workflows/deploy-sql-connect.yml")
        deploy = read("infra/ci_sql_connect_deploy.sh")
        self.assertIn("id-token: write", workflow)
        self.assertIn("google-github-actions/auth@v3", workflow)
        self.assertIn("workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}", workflow)
        self.assertIn("service_account: ${{ vars.GCP_DEPLOY_SERVICE_ACCOUNT }}", workflow)
        self.assertNotIn("credentials_json", workflow)
        self.assertNotIn("FIREBASE_TOKEN", workflow)
        self.assertIn('firebase deploy --only "dataconnect:$SERVICE"', deploy)
        for forbidden in ("gcloud run deploy", "firebase deploy --only hosting", "vercel", "appsheet", "yhct_v27", "--force"):
            self.assertNotIn(forbidden, deploy.lower())


if __name__ == "__main__":
    unittest.main()
